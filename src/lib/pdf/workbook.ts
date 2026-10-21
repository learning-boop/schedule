/**
 * Renders planner data onto the client's original workbook pages.
 *
 * Each output page draws the untouched workbook page (vector, embedded once
 * and reused) and writes the user's entries at the measured positions in
 * ./layout.ts. No headless browser is needed — this is plain PDF drawing.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  rgb,
  type PDFEmbeddedPage,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { buildMonthGrid, dayKey } from "@/lib/month-grid";
import {
  A4,
  DAILY,
  GOALS,
  LETTER,
  MONTH,
  OWNER_STAMP,
  SWOT,
  TEMPLATE_PAGE,
  WEEK,
  type Box,
  type BulletBox,
} from "./layout";

// ── Data shapes ─────────────────────────────────────────────────

export type GoalsPageData = {
  kind: "goals";
  goals: {
    title: string;
    colour: string;
    deadline: string | null; // label, e.g. "30 Nov 2026"
    subGoals: { title: string; done: boolean; deadline: string | null }[];
    nextAction: string | null;
    actionsDone: number;
    actionsTotal: number;
  }[];
};

export type MonthPageData = {
  kind: "month";
  month: string; // YYYY-MM-01
  monthLabel: string; // "October 2026"
  top3: string[];
  focus: string | null;
  dayPlans: Record<string, string>;
  /** hours of completed blocks per YYYY-MM-DD */
  hoursByDay: Record<string, number>;
};

export type SwotPageData = {
  kind: "swot";
  swot: { strengths: string; weaknesses: string; opportunities: string; threats: string };
};

export type WeekPageData = {
  kind: "week";
  weekLabel: string; // "19 – 25 Oct 2026"
  dayLabels: string[]; // 7 short dates, Monday first, e.g. "19 Oct"
  goals: { text: string; done: boolean }[];
  quote: string | null;
  /** slots[day 0=Mon][index 0..4] */
  slots: string[][];
};

export type DayPageData = {
  kind: "day";
  dateLabel: string; // "21 Oct 2026"
  weekday: number; // 0 = Sunday
  top3: { text: string; done: boolean }[];
  matrix: {
    urgent_important: string[];
    not_urgent_important: string[];
    urgent_not: string[];
    not_urgent_not: string[];
  };
  water: number;
  fitness: { text: string; done: boolean } | null;
  notes: string | null;
  /** minutes since local midnight */
  blocks: {
    title: string;
    startMin: number;
    endMin: number;
    label: string;
    done: boolean;
    colour: string;
  }[];
};

export type PlannerPage = GoalsPageData | MonthPageData | SwotPageData | WeekPageData | DayPageData;

/** One person's pages; `owner` is stamped on each page when set */
export type PlannerGroup = { owner: string | null; pages: PlannerPage[] };

// ── Assets ──────────────────────────────────────────────────────

const ASSET_DIR = path.join(process.cwd(), "src", "lib", "pdf", "assets");

type Assets = {
  template: Uint8Array;
  regular: Uint8Array;
  bold: Uint8Array;
  italic: Uint8Array;
};

let assetsPromise: Promise<Assets> | null = null;

function loadAssets(): Promise<Assets> {
  if (!assetsPromise) {
    assetsPromise = Promise.all([
      readFile(path.join(ASSET_DIR, "workbook-template.pdf")),
      readFile(path.join(ASSET_DIR, "fonts", "PlannerSans-Regular.ttf")),
      readFile(path.join(ASSET_DIR, "fonts", "PlannerSans-Bold.ttf")),
      readFile(path.join(ASSET_DIR, "fonts", "PlannerSans-Italic.ttf")),
    ])
      .then(([template, regular, bold, italic]) => ({ template, regular, bold, italic }))
      .catch((err) => {
        assetsPromise = null;
        throw err;
      });
  }
  return assetsPromise;
}

// ── Drawing helpers ─────────────────────────────────────────────

const INK = rgb(0.1, 0.14, 0.32); // dark blue "pen" ink
const MUTED = rgb(0.42, 0.45, 0.5);
const CHECK = rgb(0.09, 0.55, 0.27);

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

function hexToRgb(hex: string | null | undefined, fallback: RGB = rgb(0.01, 0.61, 0.9)): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Control characters, zero-width marks and line/paragraph separators
const CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u0008\\u000B-\\u001F\\u007F\\u200B-\\u200F\\u2028\\u2029\\uFEFF]",
  "g",
);

/** Strip control characters and normalise whitespace */
export function clean(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\r\n?/g, "\n").replace(/\t/g, " ").replace(CONTROL_CHARS, "").trim();
}

class Writer {
  constructor(
    readonly page: PDFPage,
    readonly fonts: Fonts,
    readonly height: number,
  ) {}

  /** convert a top-based y to PDF space */
  y(top: number) {
    return this.height - top;
  }

  width(text: string, size: number, font: PDFFont = this.fonts.regular) {
    return font.widthOfTextAtSize(text, size);
  }

  text(
    text: string,
    x: number,
    baseline: number,
    opts: { size: number; font?: PDFFont; color?: RGB; align?: "left" | "right" | "center" } = {
      size: 10,
    },
  ) {
    if (!text) return;
    const font = opts.font ?? this.fonts.regular;
    const w = font.widthOfTextAtSize(text, opts.size);
    const dx = opts.align === "right" ? -w : opts.align === "center" ? -w / 2 : 0;
    this.page.drawText(text, {
      x: x + dx,
      y: this.y(baseline),
      size: opts.size,
      font,
      color: opts.color ?? INK,
    });
  }

  /** Cut text to fit maxWidth, adding an ellipsis */
  truncate(text: string, size: number, maxWidth: number, font: PDFFont = this.fonts.regular) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (font.widthOfTextAtSize(text.slice(0, mid).trimEnd() + "…", size) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? text.slice(0, lo).trimEnd() + "…" : "";
  }

  /** Largest size (down to minSize) at which `text` fits on one line */
  fitSize(text: string, maxSize: number, minSize: number, maxWidth: number, font?: PDFFont) {
    let size = maxSize;
    while (size > minSize && this.width(text, size, font) > maxWidth) size -= 0.25;
    return size;
  }

  wrap(text: string, size: number, maxWidth: number, font: PDFFont = this.fonts.regular): string[] {
    const lines: string[] = [];
    for (const para of text.split("\n")) {
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push("");
        continue;
      }
      let line = "";
      for (let word of words) {
        // Break words that are longer than a whole line
        while (font.widthOfTextAtSize(word, size) > maxWidth && word.length > 1) {
          let cut = word.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
          if (line) {
            lines.push(line);
            line = "";
          }
          lines.push(word.slice(0, cut));
          word = word.slice(cut);
        }
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
        else {
          if (line) lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    return lines;
  }

  /**
   * Write wrapped text inside a box, shrinking the font until it fits
   * (down to minSize, then cutting the overflow with an ellipsis).
   */
  paragraph(
    text: string,
    box: Box,
    opts: {
      maxSize: number;
      minSize: number;
      font?: PDFFont;
      color?: RGB;
      lineHeight?: number;
      align?: "left" | "center";
      valign?: "top" | "middle";
    },
  ) {
    const t = clean(text);
    if (!t) return;
    const font = opts.font ?? this.fonts.regular;
    const lh = opts.lineHeight ?? 1.22;
    const boxW = box.right - box.left;
    const boxH = box.bottom - box.top;
    let size = opts.maxSize;
    let lines = this.wrap(t, size, boxW, font);
    while (size > opts.minSize && lines.length * size * lh > boxH) {
      size = Math.max(opts.minSize, size - 0.5);
      lines = this.wrap(t, size, boxW, font);
    }
    const maxLines = Math.max(1, Math.floor((boxH + size * (lh - 1)) / (size * lh)));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = this.truncate(lines[maxLines - 1] + " …", size, boxW, font);
    }
    const blockH = lines.length * size * lh;
    const startTop =
      opts.valign === "middle" ? box.top + Math.max(0, (boxH - blockH) / 2) : box.top;
    lines.forEach((line, i) => {
      const baseline = startTop + size * 0.9 + i * size * lh;
      const x = opts.align === "center" ? (box.left + box.right) / 2 : box.left;
      this.text(line, x, baseline, {
        size,
        font,
        color: opts.color,
        align: opts.align === "center" ? "center" : "left",
      });
    });
  }

  /** A hand-drawn style tick; (x, baseline) is the bottom-left of a size×size box */
  check(x: number, baseline: number, size: number, color: RGB = CHECK) {
    const s = size / 10;
    this.page.drawSvgPath("M0.8 5.6 L3.8 8.6 L9.4 1.6", {
      x,
      y: this.y(baseline - size),
      scale: s,
      borderColor: color,
      borderWidth: 1.6 / s,
      borderLineCap: 1,
    });
  }

  rect(left: number, top: number, w: number, h: number, color: RGB, opacity = 1) {
    this.page.drawRectangle({ x: left, y: this.y(top + h), width: w, height: h, color, opacity });
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: RGB = INK) {
    this.page.drawEllipse({
      x: cx,
      y: this.y(cy),
      xScale: rx,
      yScale: ry,
      borderColor: color,
      borderWidth: 1,
    });
  }
}

// ── Page renderers ──────────────────────────────────────────────

function drawGoals(w: Writer, data: GoalsPageData) {
  const { regular, bold } = w.fonts;
  data.goals.slice(0, 10).forEach((g, i) => {
    const top = GOALS.rows[i];
    const left = GOALS.textLeft;
    const right = GOALS.textRight;
    const b1 = top + GOALS.line1;
    const b2 = top + GOALS.line2;

    // colour dot + title, deadline on the right
    w.page.drawCircle({ x: left + 2.5, y: w.y(b1 - 3.3), size: 2.6, color: hexToRgb(g.colour) });
    const due = g.deadline ? `Due ${g.deadline}` : "";
    const dueW = due ? w.width(due, 8.5) : 0;
    const titleMax = right - (left + 9) - (due ? dueW + 10 : 0);
    w.text(w.truncate(clean(g.title), 11, titleMax, bold), left + 9, b1, { size: 11, font: bold });
    if (due) w.text(due, right, b1, { size: 8.5, color: MUTED, align: "right" });

    // second line: sub-goals with their deadlines, then the next action
    const parts: string[] = [];
    if (g.subGoals.length) {
      parts.push(
        "Sub-goals: " +
          g.subGoals
            .map(
              (s) =>
                `${clean(s.title)}${s.deadline ? ` (${s.deadline})` : ""}${s.done ? " – done" : ""}`,
            )
            .join(" · "),
      );
    }
    if (g.actionsTotal > 0) {
      parts.push(
        g.nextAction
          ? `Next: ${clean(g.nextAction)} (${g.actionsDone}/${g.actionsTotal} activities done)`
          : `All ${g.actionsTotal} activities done`,
      );
    }
    if (parts.length) {
      const line = parts.join("   |   ");
      const size = w.fitSize(line, 8.5, 7, right - left - 9);
      w.text(w.truncate(line, size, right - left - 9, regular), left + 9, b2, {
        size,
        color: MUTED,
      });
    }
  });
}

function drawMonth(w: Writer, data: MonthPageData) {
  const { bold, regular } = w.fonts;
  w.text(data.monthLabel, MONTH.monthValue.x, MONTH.monthValue.baseline, { size: 11, font: bold });

  data.top3.slice(0, 3).forEach((t, i) => {
    const max = MONTH.top3.right - MONTH.top3.x;
    const text = clean(t);
    const size = w.fitSize(text, 10.5, 8, max);
    w.text(w.truncate(text, size, max), MONTH.top3.x, MONTH.top3.baselines[i], { size });
  });

  const grid = buildMonthGrid(data.month, 5);
  const cols = MONTH.gridCols;
  const rows = MONTH.gridRows;
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      const left = cols[c + 1];
      const right = cols[c + 2];
      const top = rows[r + 1];
      const bottom = rows[r + 2];
      w.text(String(cell.day), left + 3, top + 9, { size: 8, font: bold, color: MUTED });
      const hours = data.hoursByDay[dayKey(data.month, cell.day)];
      if (hours && hours > 0) {
        w.text(`${Math.round(hours * 10) / 10}h`, right - 3, top + 9, {
          size: 7,
          color: MUTED,
          align: "right",
        });
      }
      const plan = data.dayPlans[String(cell.day)];
      if (plan) {
        w.paragraph(
          plan,
          { left: left + 3, top: top + 11.5, right: right - 3, bottom: bottom - 1.5 },
          {
            maxSize: 8,
            minSize: 5.5,
            font: regular,
            lineHeight: 1.12,
          },
        );
      }
    }
  }

  if (data.focus) w.paragraph(data.focus, MONTH.focus, { maxSize: 11, minSize: 7 });
}

function drawSwot(w: Writer, data: SwotPageData) {
  for (const key of ["strengths", "weaknesses", "opportunities", "threats"] as const) {
    if (data.swot[key]) w.paragraph(data.swot[key], SWOT[key], { maxSize: 11, minSize: 7 });
  }
}

function writeBulletRows(
  w: Writer,
  box: BulletBox,
  items: { text: string; done?: boolean }[],
  size = 10,
) {
  items.slice(0, box.rows.length).forEach((item, i) => {
    const cy = box.rows[i];
    const text = clean(item.text);
    if (!text && !item.done) return;
    if (item.done) w.check(box.circleX - 4.2, cy + 4.2, 8.4);
    const max = box.textRight - box.textLeft;
    const s = w.fitSize(text, size, 8, max);
    w.text(w.truncate(text, s, max), box.textLeft, cy + 3.2, { size: s });
  });
}

function drawWeek(w: Writer, data: WeekPageData) {
  const { italic } = w.fonts;
  w.text(data.weekLabel, WEEK.weekLabel.right, WEEK.weekLabel.baseline, {
    size: 9,
    color: MUTED,
    align: "right",
  });
  writeBulletRows(w, WEEK.goals, data.goals);
  if (data.quote) {
    w.paragraph(`“${clean(data.quote)}”`, WEEK.quote, {
      maxSize: 11,
      minSize: 7,
      font: italic,
      align: "center",
      valign: "middle",
    });
  }
  WEEK.days.forEach((box, d) => {
    w.text(data.dayLabels[d] ?? "", box.headerRight - 5, box.headerBaseline, {
      size: 8,
      color: MUTED,
      align: "right",
    });
    writeBulletRows(
      w,
      box,
      (data.slots[d] ?? []).map((text) => ({ text })),
    );
  });
}

const DROP_PATH =
  "M5 0 C6.6 3.1 10 7.1 10 10.9 C10 13.8 7.8 16 5 16 C2.2 16 0 13.8 0 10.9 C0 7.1 3.4 3.1 5 0 Z";

function drawDay(w: Writer, data: DayPageData) {
  const { bold, regular } = w.fonts;

  // ONE / TWO / THREE
  data.top3.slice(0, 3).forEach((item, i) => {
    const box = DAILY.top3[i];
    const inner = { ...box };
    if (item.done) {
      w.check(box.left, box.top + 10, 9);
      inner.left += 13;
    }
    w.paragraph(item.text, inner, { maxSize: 11, minSize: 7 });
  });

  // DATE + circle the weekday
  const dateSize = w.fitSize(data.dateLabel, 9.5, 7, DAILY.date.right - DAILY.date.x, bold);
  w.text(data.dateLabel, DAILY.date.x, DAILY.date.baseline, { size: dateSize, font: bold });
  const wd = DAILY.weekdays[data.weekday];
  if (wd) {
    const cy = (DAILY.weekdayY.top + DAILY.weekdayY.bottom) / 2;
    w.ellipse((wd.left + wd.right) / 2, cy, (wd.right - wd.left) / 2 + 3.5, 7.5);
  }

  // SCHEDULE: one row per hour, 6:00 → 22:00
  const sch = DAILY.schedule;
  const firstMin = sch.firstHour * 60;
  const lastMin = (sch.firstHour + sch.rowCount) * 60;
  const rows: DayPageData["blocks"][] = Array.from({ length: sch.rowCount }, () => []);
  const sorted = [...data.blocks].sort((a, b) => a.startMin - b.startMin);
  for (const b of sorted) {
    const idx = Math.min(
      sch.rowCount - 1,
      Math.max(0, Math.floor(b.startMin / 60) - sch.firstHour),
    );
    rows[idx].push(b);
    // duration bar in the margin, in the block's colour
    const s = Math.max(firstMin, Math.min(lastMin, b.startMin));
    const e = Math.max(firstMin, Math.min(lastMin, b.endMin));
    if (e - s >= 10) {
      const y1 = sch.top + ((s - firstMin) / 60) * sch.rowHeight + 1.5;
      const y2 = sch.top + ((e - firstMin) / 60) * sch.rowHeight - 1.5;
      w.rect(sch.barX - 1.1, y1, 2.2, Math.max(2, y2 - y1), hexToRgb(b.colour), 0.85);
    }
  }
  rows.forEach((list, i) => {
    if (!list.length) return;
    const baseline = sch.top + i * sch.rowHeight + sch.baselineOffset;
    const maxW = sch.textRight - sch.textLeft;
    const sep = "  ·  ";
    const labels = list.map((b) => clean(b.label));
    const checkW = (size: number) => size * 1.1;
    const totalW = (size: number) =>
      labels.reduce(
        (sum, l, j) =>
          sum +
          w.width(l, size) +
          (list[j].done ? checkW(size) : 0) +
          (j > 0 ? w.width(sep, size) : 0),
        0,
      );
    let size = 9.5;
    while (size > 6.5 && totalW(size) > maxW) size -= 0.25;
    let x = sch.textLeft;
    const end = sch.textRight;
    list.forEach((b, j) => {
      if (x >= end - 4) return;
      if (j > 0) {
        w.text(sep, x, baseline, { size, color: MUTED });
        x += w.width(sep, size);
      }
      if (b.done) {
        w.check(x, baseline + 0.5, size * 0.85);
        x += checkW(size);
      }
      const t = w.truncate(labels[j], size, end - x, regular);
      w.text(t, x, baseline, { size });
      x += w.width(t, size);
    });
  });

  // Eisenhower matrix
  for (const key of [
    "urgent_important",
    "not_urgent_important",
    "urgent_not",
    "not_urgent_not",
  ] as const) {
    const items = (data.matrix[key] ?? []).map(clean).filter(Boolean);
    if (items.length) {
      w.paragraph(items.map((t) => `• ${t}`).join("\n"), DAILY.matrix[key], {
        maxSize: 9.5,
        minSize: 6,
        lineHeight: 1.18,
      });
    }
  }

  // Fitness
  if (data.fitness && (data.fitness.text || data.fitness.done)) {
    const box = { ...DAILY.fitness };
    if (data.fitness.done) {
      w.check(box.left, box.top + 10, 9);
      box.left += 13;
    }
    w.paragraph(data.fitness.text || "Done", box, { maxSize: 10.5, minSize: 7 });
  }

  // Water: fill one drop per glass
  const glasses = Math.max(0, Math.min(9, Math.round(data.water)));
  for (let i = 0; i < glasses; i++) {
    const r = DAILY.waterRows[Math.floor(i / 3)];
    const c = DAILY.waterCols[i % 3];
    const boxW = c.right - c.left;
    const boxH = r.bottom - r.top;
    const scale = Math.min((boxW - 5.2) / 10, (boxH - 6) / 16);
    const dw = 10 * scale;
    const dh = 16 * scale;
    const x = c.left + (boxW - dw) / 2;
    const top = r.top + (boxH - dh) / 2 + 1.2;
    w.page.drawSvgPath(DROP_PATH, {
      x,
      y: w.y(top),
      scale,
      color: rgb(0.27, 0.6, 0.93),
      opacity: 0.75,
    });
  }

  // NOTES on the ruled lines (shrinks if there is more to say)
  const notes = clean(data.notes);
  if (notes) {
    const n = DAILY.notes;
    const maxW = n.right - n.left;
    const lines = w.wrap(notes, 10.5, maxW);
    if (lines.length <= n.baselines.length) {
      lines.forEach((line, i) => w.text(line, n.left, n.baselines[i], { size: 10.5 }));
    } else {
      w.paragraph(
        notes,
        { left: n.left, top: n.top, right: n.right, bottom: n.bottom },
        {
          maxSize: 9.5,
          minSize: 6.5,
        },
      );
    }
  }
}

// ── Document ────────────────────────────────────────────────────

export async function renderWorkbook(groups: PlannerGroup[]): Promise<Uint8Array> {
  const assets = await loadAssets();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle("Time management planner");
  doc.setCreator("Schedule Planner");
  doc.setProducer("Schedule Planner");

  const template = await PDFDocument.load(assets.template);
  // The fonts are already small Latin subsets: embed them whole, because
  // pdf-lib's own subsetter drops glyphs from this font. Ligatures off, since
  // pdf-lib maps ligature glyphs poorly ("ti" → "t i").
  const fontOptions = {
    subset: false,
    features: { liga: false, clig: false, dlig: false, calt: false },
  };
  const needsItalic = groups.some((g) => g.pages.some((p) => p.kind === "week" && !!p.quote));
  const regular = await doc.embedFont(assets.regular, fontOptions);
  const fonts: Fonts = {
    regular,
    bold: await doc.embedFont(assets.bold, fontOptions),
    italic: needsItalic ? await doc.embedFont(assets.italic, fontOptions) : regular,
  };

  // Each workbook page is embedded once and reused for every output page
  const embedded = new Map<number, PDFEmbeddedPage>();
  async function background(index: number) {
    let e = embedded.get(index);
    if (!e) {
      e = await doc.embedPage(template.getPage(index));
      embedded.set(index, e);
    }
    return e;
  }

  for (const group of groups) {
    for (const data of group.pages) {
      const isDaily = data.kind === "day";
      const size = isDaily ? A4 : LETTER;
      const index =
        data.kind === "goals"
          ? TEMPLATE_PAGE.goals
          : data.kind === "month"
            ? TEMPLATE_PAGE.month
            : data.kind === "swot"
              ? TEMPLATE_PAGE.swot
              : data.kind === "week"
                ? TEMPLATE_PAGE.week
                : TEMPLATE_PAGE.daily;

      const page = doc.addPage([size.width, size.height]);
      page.drawPage(await background(index), {
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
      });
      const w = new Writer(page, fonts, size.height);

      if (data.kind === "goals") drawGoals(w, data);
      else if (data.kind === "month") drawMonth(w, data);
      else if (data.kind === "swot") drawSwot(w, data);
      else if (data.kind === "week") drawWeek(w, data);
      else drawDay(w, data);

      if (group.owner) {
        const stamp = isDaily ? OWNER_STAMP.a4 : OWNER_STAMP.letter;
        w.text(clean(group.owner), stamp.right, stamp.baseline, {
          size: 8,
          color: MUTED,
          align: "right",
        });
      }
    }
  }

  return doc.save();
}
