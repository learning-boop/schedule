/**
 * Geometry of the client's "Time management" workbook pages, in PDF points,
 * measured from the original workbook PDF (top-left origin, y grows down).
 *
 * The export draws the original workbook page (vector, from
 * assets/workbook-template.pdf) and writes the user's data onto it at these
 * positions — so the PDF is the workbook, filled in.
 *
 * Template pages: 0 Goals (Letter), 1 Month (Letter), 2 SWOT (Letter),
 * 3 Week (Letter), 4 "To Do Today" daily page (A4).
 */

export const LETTER = { width: 612, height: 792 } as const;
export const A4 = { width: 594.96, height: 842.88 } as const;

export const TEMPLATE_PAGE = { goals: 0, month: 1, swot: 2, week: 3, daily: 4 } as const;

export type Box = { left: number; top: number; right: number; bottom: number };

// ── Page 1: Goals ───────────────────────────────────────────────
export const GOALS = {
  /** Horizontal rules of the 10-row goal table (11 lines) */
  rows: [127.1, 164.5, 200.2, 237.6, 273.2, 310.5, 346.1, 383.6, 419.0, 456.5, 493.9],
  /** Writable column, right of the "Goal n" labels */
  textLeft: 122,
  textRight: 547,
  /** Baselines inside a row, aligned with the "Goal n" label */
  line1: 10.9,
  line2: 24.0,
};

// ── Page 5: Month ───────────────────────────────────────────────
export const MONTH = {
  /** After the "Month:" label */
  monthValue: { x: 110, baseline: 82.4 },
  /** Top 3 rows, after "1. –", "2. –", "3. –" */
  top3: { x: 196, right: 540, baselines: [108.0, 134.9, 161.8] },
  /** Column edges: label | Week1 | Week 2 | Week 3 | Week 4 | Week 5 */
  gridCols: [66.4, 145.8, 225.2, 304.6, 383.8, 463.1, 542.5],
  /** Row edges: header | Monday … Sunday */
  gridRows: [191.2, 212.8, 254.3, 297.0, 338.6, 380.3, 421.9, 464.6, 507.2],
  /** "This month's Focus" writable area */
  focus: { left: 153, top: 537, right: 541, bottom: 624 } as Box,
};

// ── SWOT page ───────────────────────────────────────────────────
export const SWOT: Record<"strengths" | "weaknesses" | "opportunities" | "threats", Box> = {
  strengths: { left: 71, top: 140, right: 304, bottom: 331 },
  weaknesses: { left: 314, top: 140, right: 547, bottom: 331 },
  opportunities: { left: 71, top: 366, right: 304, bottom: 564 },
  threats: { left: 314, top: 366, right: 547, bottom: 564 },
};

// ── Page 6: Week ────────────────────────────────────────────────
/** A box of circle bullets with dotted writing lines */
export type BulletBox = {
  circleX: number;
  /** y of each circle centre */
  rows: number[];
  textLeft: number;
  textRight: number;
};

export type DayBox = BulletBox & {
  /** Baseline of the day name in the header strip, and its right edge */
  headerBaseline: number;
  headerRight: number;
};

export const WEEK = {
  /** Small "week of" label, top right of the page */
  weekLabel: { right: 562, baseline: 54 },
  goals: {
    circleX: 50.4,
    rows: [95.0, 114.5, 133.9, 153.0, 172.4, 191.9, 211.1, 230.4, 249.8],
    textLeft: 61,
    textRight: 276,
  } as BulletBox,
  quote: { left: 315, top: 91, right: 556, bottom: 130 } as Box,
  /** Monday … Sunday */
  days: [
    {
      circleX: 327.4,
      rows: [169.4, 189.5, 209.5, 229.5, 249.5],
      textLeft: 338,
      textRight: 556,
      headerBaseline: 152.5,
      headerRight: 556,
    },
    {
      circleX: 50.9,
      rows: [299.2, 321.1, 343.3, 365.2, 387.4],
      textLeft: 61.5,
      textRight: 280,
      headerBaseline: 279.3,
      headerRight: 280,
    },
    {
      circleX: 327.6,
      rows: [299.2, 321.1, 343.3, 365.2, 387.4],
      textLeft: 338,
      textRight: 556,
      headerBaseline: 279.3,
      headerRight: 556,
    },
    {
      circleX: 51.1,
      rows: [439.2, 459.4, 479.9, 500.4, 520.6],
      textLeft: 61.5,
      textRight: 280,
      headerBaseline: 421.9,
      headerRight: 280,
    },
    {
      circleX: 328.0,
      rows: [439.2, 459.7, 479.9, 500.4, 520.7],
      textLeft: 338.5,
      textRight: 556,
      headerBaseline: 422.1,
      headerRight: 556,
    },
    {
      circleX: 50.4,
      rows: [569.5, 589.5, 609.3, 629.5, 649.3],
      textLeft: 61,
      textRight: 279,
      headerBaseline: 552.3,
      headerRight: 279,
    },
    {
      circleX: 327.1,
      rows: [568.8, 588.8, 608.6, 628.7, 648.5],
      textLeft: 337.5,
      textRight: 556,
      headerBaseline: 551.6,
      headerRight: 556,
    },
  ] as DayBox[],
};

// ── Daily page: "To Do Today" (A4) ──────────────────────────────
export const DAILY = {
  /** ONE / TWO / THREE boxes */
  top3: [
    { left: 42, top: 141, right: 204, bottom: 205 },
    { left: 215, top: 141, right: 380, bottom: 205 },
    { left: 391, top: 141, right: 554, bottom: 205 },
  ] as Box[],
  /** After the "DATE" label */
  date: { x: 75, baseline: 235.8, right: 147 },
  /** SU MO TU WE TH FR SA (index 0 = Sunday) */
  weekdays: [
    { left: 150.5, right: 162.4 },
    { left: 168.2, right: 184.4 },
    { left: 190.1, right: 202.3 },
    { left: 208.7, right: 223.3 },
    { left: 229.7, right: 242.0 },
    { left: 250.1, right: 261.4 },
    { left: 269.8, right: 281.3 },
  ],
  weekdayY: { top: 227.1, bottom: 238.2 },
  /** Hourly schedule: 17 rows, 6:00 → 22:00 */
  schedule: {
    firstHour: 6,
    rowCount: 17,
    top: 268.5,
    rowHeight: 24.07,
    textLeft: 68,
    textRight: 279,
    barX: 63.5,
    baselineOffset: 16,
  },
  /** Eisenhower matrix cells */
  matrix: {
    urgent_important: { left: 339, top: 250, right: 443, bottom: 372 },
    not_urgent_important: { left: 453, top: 250, right: 557, bottom: 372 },
    urgent_not: { left: 339, top: 382, right: 443, bottom: 504 },
    not_urgent_not: { left: 453, top: 382, right: 557, bottom: 504 },
  } as Record<"urgent_important" | "not_urgent_important" | "urgent_not" | "not_urgent_not", Box>,
  fitness: { left: 315, top: 562, right: 443, bottom: 673 } as Box,
  /** 3 × 3 water drops (outline bounding boxes), row-major */
  waterRows: [
    { top: 568.3, bottom: 596.7 },
    { top: 603.2, bottom: 632.0 },
    { top: 638.5, bottom: 666.9 },
  ],
  waterCols: [
    { left: 463.6, right: 481.2 },
    { left: 496.7, right: 514.0 },
    { left: 529.5, right: 546.7 },
  ],
  /** NOTES: text sits on these ruled lines */
  notes: {
    left: 66,
    right: 550,
    baselines: [711.0, 735.1, 759.2, 783.3, 807.4],
    top: 692,
    bottom: 809,
  },
};

/** Where the owner's name goes when exporting someone else's planner */
export const OWNER_STAMP = {
  letter: { right: 576, baseline: 774 },
  a4: { right: 559, baseline: 830 },
};
