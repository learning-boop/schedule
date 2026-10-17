import { BASE_CSS } from "./styles";

type GoalData = {
  title: string;
  colour: string;
  rank: number;
  deadline: string | null;
  sub_goals: { title: string; done: boolean; deadline: string | null }[];
  actions: { title: string; done: boolean; order: number }[];
};

type MonthData = {
  month: string;
  top3: string[];
  focus: string | null;
  swot: { strengths: string; weaknesses: string; opportunities: string; threats: string };
};

type WeekData = {
  weekStart: string;
  goals: { text: string; done: boolean }[];
  quote: string | null;
  slots: { day: number; index: number; text: string }[];
};

type DailyData = {
  date: string;
  top3: { text: string; done: boolean; goalId?: string }[];
  matrix: {
    urgent_important: string[];
    urgent_not: string[];
    not_urgent_important: string[];
    not_urgent_not: string[];
  };
  water: number;
  fitness: string | null;
  notes: string | null;
  blocks: { title: string; start: string; end: string; done: boolean; category: string | null }[];
};

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>${BASE_CSS}</style>
</head><body>${body}</body></html>`;
}

function footer(dateLabel: string): string {
  return `<div class="page-footer">
    <span>Schedule Planner</span>
    <span>${esc(dateLabel)}</span>
  </div>`;
}

// ── Page 1: Goals ──
export function goalsPage(goals: GoalData[]): string {
  const rows = goals
    .sort((a, b) => a.rank - b.rank)
    .map((g, i) => {
      const subGoalRows = g.sub_goals
        .map(
          (sg) =>
            `<div class="lined-row" style="padding-left:9mm">
              <span class="checkbox${sg.done ? " checked" : ""}"></span>
              <span>${esc(sg.title)}</span>
              ${sg.deadline ? `<span style="margin-left:auto;font-size:9px;color:#888">${esc(sg.deadline)}</span>` : ""}
            </div>`,
        )
        .join("");

      const actionRows = g.actions
        .sort((a, b) => a.order - b.order)
        .map(
          (a) =>
            `<div class="lined-row" style="padding-left:9mm">
              <span class="checkbox${a.done ? " checked" : ""}"></span>
              <span style="font-size:10px">${esc(a.title)}</span>
            </div>`,
        )
        .join("");

      return `
        <div class="section">
          <div class="lined-row tall numbered">
            <span class="num-circle" style="background:${esc(g.colour)}">${i + 1}</span>
            <strong style="font-size:12px">${esc(g.title)}</strong>
            ${g.deadline ? `<span style="margin-left:auto;font-size:9px;color:#888">Due: ${esc(g.deadline)}</span>` : ""}
          </div>
          ${subGoalRows}
          ${actionRows}
        </div>`;
    })
    .join("");

  return `<div class="page">
    <div class="page-header">
      <div class="page-title">Goals</div>
      <div class="page-subtitle">Track your progress</div>
    </div>
    ${rows || '<p style="color:#999;text-align:center;margin-top:20mm">No goals set yet.</p>'}
    ${footer("Goals")}
  </div>`;
}

// ── Page 5: Month ──
export function monthPage(data: MonthData): string {
  const monthDate = new Date(data.month + "T00:00:00");
  const monthLabel = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const top3Rows = Array.from({ length: 3 }, (_, i) => {
    const text = data.top3[i] ?? "";
    return `<div class="lined-row numbered">
      <span class="num-circle">${i + 1}</span>
      <span>${esc(text)}</span>
    </div>`;
  }).join("");

  return `<div class="page">
    <div class="page-header">
      <div class="page-title">${esc(monthLabel)}</div>
      <div class="page-subtitle">Monthly Plan</div>
    </div>

    <div class="section">
      <div class="section-title">Top 3 Goals</div>
      ${top3Rows}
    </div>

    <div class="section">
      <div class="section-title">This Month's Focus</div>
      <div class="notes-box" style="min-height:18mm">${esc(data.focus)}</div>
    </div>

    <div class="section">
      <div class="section-title">SWOT Analysis</div>
      <div class="swot-grid">
        <div class="swot-cell swot-s">
          <div class="swot-label">Strengths</div>
          <div class="swot-text">${esc(data.swot.strengths)}</div>
        </div>
        <div class="swot-cell swot-w">
          <div class="swot-label">Weaknesses</div>
          <div class="swot-text">${esc(data.swot.weaknesses)}</div>
        </div>
        <div class="swot-cell swot-o">
          <div class="swot-label">Opportunities</div>
          <div class="swot-text">${esc(data.swot.opportunities)}</div>
        </div>
        <div class="swot-cell swot-t">
          <div class="swot-label">Threats</div>
          <div class="swot-text">${esc(data.swot.threats)}</div>
        </div>
      </div>
    </div>

    ${footer(monthLabel)}
  </div>`;
}

// ── Page 6: Week ──
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function weekPage(data: WeekData): string {
  const weekDate = new Date(data.weekStart + "T00:00:00");
  const weekEnd = new Date(weekDate);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const goalRows = (data.goals || [])
    .map(
      (g) =>
        `<div class="lined-row">
          <span class="checkbox${g.done ? " checked" : ""}"></span>
          <span>${esc(g.text)}</span>
        </div>`,
    )
    .join("");

  // Build slot grid: 5 rows x 7 columns
  const slotMap = new Map<string, string>();
  for (const s of data.slots || []) {
    slotMap.set(`${s.day}-${s.index}`, s.text);
  }

  const headerCells = DAY_NAMES.map((d, i) => {
    const dayDate = new Date(weekDate);
    dayDate.setDate(dayDate.getDate() + i);
    return `<th>${d}<br><span style="font-weight:400;font-size:8px">${dayDate.getDate()}</span></th>`;
  }).join("");

  const bodyRows = Array.from({ length: 5 }, (_, slotIdx) => {
    const cells = Array.from({ length: 7 }, (_, dayIdx) => {
      const text = slotMap.get(`${dayIdx}-${slotIdx}`) ?? "";
      return `<td>${esc(text)}</td>`;
    }).join("");
    return `<tr><td style="text-align:center;font-weight:600;background:#f9f9f9;width:6mm">${slotIdx + 1}</td>${cells}</tr>`;
  }).join("");

  return `<div class="page">
    <div class="page-header">
      <div class="page-title">Week Plan</div>
      <div class="page-subtitle">${esc(weekLabel)}</div>
    </div>

    ${data.quote ? `<blockquote style="border-left:2px solid #999;padding-left:3mm;font-style:italic;color:#666;margin-bottom:4mm;font-size:10px">${esc(data.quote)}</blockquote>` : ""}

    <div class="section">
      <div class="section-title">Week Goals</div>
      ${goalRows || '<div class="lined-row" style="color:#999">No goals set</div>'}
    </div>

    <div class="section">
      <div class="section-title">Day Slots</div>
      <table class="week-table">
        <thead><tr><th>#</th>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>

    ${footer(weekLabel)}
  </div>`;
}

// ── Daily Page (To Do Today) ──
export function dailyPage(data: DailyData): string {
  const d = new Date(data.date + "T00:00:00");
  const dayLabel = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Top 3
  const top3Rows = Array.from({ length: 3 }, (_, i) => {
    const item = data.top3[i];
    return `<div class="lined-row numbered">
      <span class="num-circle">${i + 1}</span>
      ${item ? `<span class="checkbox${item.done ? " checked" : ""}"></span><span>${esc(item.text)}</span>` : ""}
    </div>`;
  }).join("");

  // Matrix
  function matrixItems(arr: string[]): string {
    return (arr || [])
      .map((t) => `<div style="font-size:10px;margin-bottom:1mm">• ${esc(t)}</div>`)
      .join("");
  }

  // Schedule (6am – 10pm)
  const scheduleRows = Array.from({ length: 17 }, (_, i) => {
    const hour = i + 6;
    const label = hour <= 12 ? `${hour}${hour < 12 ? "am" : "pm"}` : `${hour - 12}pm`;
    const hourStart = `${String(hour).padStart(2, "0")}:00`;
    const block = data.blocks.find((b) => {
      const bh = new Date(b.start).getHours();
      return bh === hour;
    });
    return `<div class="schedule-line">
      <span class="time-label">${label}</span>
      <span class="schedule-content${block?.done ? " schedule-done" : ""}">${block ? esc(block.title) : ""}</span>
    </div>`;
  }).join("");

  // Water tracker
  const waterDots = Array.from(
    { length: 8 },
    (_, i) => `<span class="water-dot${i < data.water ? " filled" : ""}"></span>`,
  ).join("");

  return `<div class="page">
    <div class="page-header">
      <div class="page-title">To Do Today</div>
      <div class="page-subtitle">${esc(dayLabel)}</div>
    </div>

    <div style="display:flex;gap:4mm">
      <!-- Left column -->
      <div style="flex:1">
        <div class="section">
          <div class="section-title">Top 3 Priorities</div>
          ${top3Rows}
        </div>

        <div class="section">
          <div class="section-title">Eisenhower Matrix</div>
          <div class="matrix-grid">
            <div class="matrix-cell">
              <div class="matrix-label">Urgent & Important</div>
              ${matrixItems(data.matrix.urgent_important)}
            </div>
            <div class="matrix-cell">
              <div class="matrix-label">Not Urgent & Important</div>
              ${matrixItems(data.matrix.not_urgent_important)}
            </div>
            <div class="matrix-cell">
              <div class="matrix-label">Urgent & Not Important</div>
              ${matrixItems(data.matrix.urgent_not)}
            </div>
            <div class="matrix-cell">
              <div class="matrix-label">Not Urgent & Not Important</div>
              ${matrixItems(data.matrix.not_urgent_not)}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Trackers</div>
          <div class="tracker-row">
            <span class="tracker-label">Water</span>
            ${waterDots}
          </div>
          ${data.fitness ? `<div class="tracker-row"><span class="tracker-label">Fitness</span><span style="font-size:10px">${esc(data.fitness)}</span></div>` : ""}
        </div>

        ${data.notes ? `<div class="section"><div class="section-title">Notes</div><div class="notes-box">${esc(data.notes)}</div></div>` : ""}
      </div>

      <!-- Right column: Schedule -->
      <div style="width:55mm;flex-shrink:0">
        <div class="section">
          <div class="section-title">Schedule</div>
          ${scheduleRows}
        </div>
      </div>
    </div>

    ${footer(dayLabel)}
  </div>`;
}

export function buildHTML(pages: string[]): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>${BASE_CSS}</style>
</head><body>${pages.join("")}</body></html>`;
}
