export const BASE_CSS = `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 11px;
  line-height: 1.4;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.page {
  width: 210mm;
  height: 297mm;
  padding: 12mm 14mm;
  page-break-after: always;
  position: relative;
}
.page:last-child { page-break-after: auto; }

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 2px solid #1a1a1a;
  padding-bottom: 4mm;
  margin-bottom: 5mm;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
.page-subtitle {
  font-size: 10px;
  color: #666;
}

/* Sections */
.section { margin-bottom: 5mm; }
.section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2mm;
  color: #333;
}

/* Grid cells / lined rows */
.lined-row {
  border-bottom: 1px solid #ddd;
  padding: 2mm 1mm;
  min-height: 7mm;
  display: flex;
  align-items: center;
}
.lined-row.tall { min-height: 10mm; }
.numbered {
  display: flex;
  align-items: center;
  gap: 2mm;
}
.num-circle {
  width: 5mm;
  height: 5mm;
  border-radius: 50%;
  background: #1a1a1a;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.checkbox {
  width: 4mm;
  height: 4mm;
  border: 1.5px solid #999;
  border-radius: 1px;
  flex-shrink: 0;
  margin-right: 2mm;
}
.checkbox.checked {
  background: #1a1a1a;
  border-color: #1a1a1a;
}

/* SWOT Grid */
.swot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 1.5px solid #333;
}
.swot-cell {
  padding: 2.5mm;
  min-height: 32mm;
  border: 0.5px solid #ccc;
}
.swot-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 1.5mm;
}
.swot-s .swot-label { color: #16a34a; }
.swot-w .swot-label { color: #dc2626; }
.swot-o .swot-label { color: #2563eb; }
.swot-t .swot-label { color: #d97706; }
.swot-text {
  font-size: 10px;
  white-space: pre-wrap;
  line-height: 1.5;
}

/* Week grid table */
.week-table {
  width: 100%;
  border-collapse: collapse;
}
.week-table th, .week-table td {
  border: 1px solid #ccc;
  padding: 1.5mm 2mm;
  text-align: left;
  font-size: 10px;
  vertical-align: top;
}
.week-table th {
  background: #f5f5f5;
  font-weight: 700;
  font-size: 9px;
  text-transform: uppercase;
  text-align: center;
}
.week-table td { min-height: 8mm; height: 8mm; }

/* Matrix */
.matrix-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 1.5px solid #333;
}
.matrix-cell {
  padding: 2.5mm;
  min-height: 30mm;
  border: 0.5px solid #ccc;
}
.matrix-label {
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 1.5mm;
  color: #555;
}

/* Notes area */
.notes-box {
  border: 1px solid #ccc;
  padding: 2.5mm;
  min-height: 25mm;
  font-size: 10px;
  white-space: pre-wrap;
  line-height: 1.6;
  background: repeating-linear-gradient(
    transparent,
    transparent 6.5mm,
    #eee 6.5mm,
    #eee 7mm
  );
}

/* Trackers */
.tracker-row {
  display: flex;
  align-items: center;
  gap: 3mm;
  margin-bottom: 2mm;
}
.tracker-label {
  font-size: 9px;
  font-weight: 600;
  width: 18mm;
}
.water-dot {
  width: 4.5mm;
  height: 4.5mm;
  border-radius: 50%;
  border: 1.5px solid #3b82f6;
}
.water-dot.filled { background: #3b82f6; }

/* Footer */
.page-footer {
  position: absolute;
  bottom: 8mm;
  left: 14mm;
  right: 14mm;
  font-size: 8px;
  color: #aaa;
  display: flex;
  justify-content: space-between;
}

/* Schedule lines */
.schedule-line {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #ddd;
  min-height: 6.5mm;
}
.time-label {
  width: 12mm;
  font-size: 9px;
  font-weight: 600;
  color: #666;
  flex-shrink: 0;
}
.schedule-content {
  flex: 1;
  font-size: 10px;
  padding-left: 2mm;
}
.schedule-done {
  text-decoration: line-through;
  color: #999;
}
`;
