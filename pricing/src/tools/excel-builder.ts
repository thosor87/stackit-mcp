import ExcelJS from 'exceljs';
import type { GroupSummary } from './export-estimate.js';

const TEAL   = 'FF00A0AF';
const DARK   = 'FF003A4A';
const LTEAL  = 'FFE8F7F8';
const LGRAY  = 'FFF5F5F5';
const WHITE  = 'FFFFFFFF';
const MTEAL  = 'FFEBF6F7';
const BORDER = 'FFD0E8EA';

function eur(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function setCell(
  ws: ExcelJS.Worksheet,
  row: number, col: number,
  value: ExcelJS.CellValue,
  opts: {
    bold?: boolean; size?: number; color?: string; bg?: string;
    align?: ExcelJS.Alignment['horizontal']; indent?: number; italic?: boolean;
  } = {}
) {
  const c = ws.getCell(row, col);
  c.value = value;
  c.font = {
    bold: opts.bold ?? false,
    size: opts.size ?? 10.5,
    italic: opts.italic ?? false,
    color: { argb: opts.color ?? DARK },
  };
  if (opts.bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
  c.alignment = {
    vertical: 'middle',
    horizontal: opts.align ?? (col === 1 ? 'left' : 'right'),
    indent: opts.indent ?? 0,
  };
  c.border = { bottom: { style: 'hair', color: { argb: BORDER } } };
}

const SERVICE_NOTES: Record<string, string> = {
  'server':            'inkl. 64 GB Boot-Volume (Performance 0)',
  'load-balancer':     'inkl. 2× c2i.1 Compute Nodes',
  'database-postgres': 'Managed PostgreSQL, Single/Replica wählbar',
  'database-mariadb':  'Managed MariaDB',
  'database-redis':    'Managed In-Memory Cache',
  'object-storage':    'S3-kompatibel, pay-per-GB',
  'block-storage':     'NVMe, Premium-Capacity',
  'ske':               'Managed Kubernetes, pay-per-cluster',
  'public-ip':         'Floating IPv4',
};

function configLabel(config: Record<string, unknown>): string {
  return Object.entries(config).map(([k, v]) => `${k}: ${v}`).join(', ');
}

export async function buildExcel(
  name: string,
  groups: GroupSummary[],
  total_month: number,
  total_year: number,
  source: string,
  date: string
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'stackit-mcp';
  wb.created = new Date();

  // ── Sheet 1: Übersicht ─────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Übersicht', { views: [{ showGridLines: false }] });
  ws.columns = [
    { width: 36 }, // Stage / Service
    { width: 20 }, // EUR/Monat
    { width: 20 }, // EUR/Jahr
    { width: 12 }, // %
  ];

  // Title block
  ws.mergeCells('A1:D1');
  const t = ws.getCell('A1');
  t.value = name;
  t.font = { bold: true, size: 18, color: { argb: DARK } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LTEAL } };
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 40;

  ws.mergeCells('A2:D2');
  const sub = ws.getCell('A2');
  sub.value = `STACKIT Kostenschätzung · ${date} · Preisquelle: PIM API (${source})`;
  sub.font = { size: 9, italic: true, color: { argb: 'FF666666' } };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LTEAL } };
  sub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6;

  // Column headers
  let r = 4;
  const headers = ['Stage / Service', 'EUR / Monat', 'EUR / Jahr', 'Anteil'];
  for (let c = 1; c <= 4; c++) {
    setCell(ws, r, c, headers[c - 1], { bold: true, size: 11, color: WHITE, bg: DARK });
  }
  ws.getRow(r).height = 24;

  // Track data bar range start
  const dataBarStart = r + 1;

  for (const group of groups) {
    // Stage header
    r++;
    for (let c = 1; c <= 4; c++) {
      setCell(ws, r, c, c === 1 ? group.name : '', { bold: true, size: 11, color: WHITE, bg: TEAL });
    }
    ws.getRow(r).height = 22;

    for (const svc of group.services) {
      r++;
      const pct = total_month > 0 ? (svc.monthly_cost_eur / total_month * 100).toFixed(1) + ' %' : '';
      setCell(ws, r, 1, svc.service_name, { bg: LGRAY, indent: 1 });
      setCell(ws, r, 2, svc.monthly_cost_eur, { bg: LGRAY });
      ws.getCell(r, 2).numFmt = '€ #,##0.00';
      setCell(ws, r, 3, svc.monthly_cost_eur * 12, { bg: LGRAY });
      ws.getCell(r, 3).numFmt = '€ #,##0.00';
      setCell(ws, r, 4, pct, { bg: LGRAY });
      ws.getRow(r).height = 18;
    }

    // Subtotal
    r++;
    const pct = total_month > 0 ? (group.subtotal_month_eur / total_month * 100).toFixed(1) + ' %' : '';
    setCell(ws, r, 1, `Subtotal ${group.name}`, { bold: true, bg: MTEAL, indent: 1 });
    setCell(ws, r, 2, group.subtotal_month_eur, { bold: true, bg: MTEAL });
    ws.getCell(r, 2).numFmt = '€ #,##0.00';
    setCell(ws, r, 3, group.subtotal_month_eur * 12, { bold: true, bg: MTEAL });
    ws.getCell(r, 3).numFmt = '€ #,##0.00';
    setCell(ws, r, 4, pct, { bold: true, bg: MTEAL });
    ws.getRow(r).height = 22;
    r++;
    ws.getRow(r).height = 4;
  }

  // Totals
  r++;
  setCell(ws, r, 1, 'Gesamt / Monat', { bold: true, size: 12, color: WHITE, bg: DARK });
  setCell(ws, r, 2, total_month, { bold: true, size: 12, color: WHITE, bg: DARK });
  ws.getCell(r, 2).numFmt = '€ #,##0.00';
  setCell(ws, r, 3, total_month * 12, { bold: true, size: 12, color: WHITE, bg: DARK });
  ws.getCell(r, 3).numFmt = '€ #,##0.00';
  setCell(ws, r, 4, '100 %', { bold: true, size: 12, color: WHITE, bg: DARK });
  ws.getRow(r).height = 26;

  r++;
  setCell(ws, r, 1, 'Gesamt / Jahr', { bold: true, size: 12, color: WHITE, bg: TEAL });
  setCell(ws, r, 2, '', { bg: TEAL });
  setCell(ws, r, 3, total_year, { bold: true, size: 14, color: WHITE, bg: TEAL });
  ws.getCell(r, 3).numFmt = '€ #,##0.00';
  setCell(ws, r, 4, '', { bg: TEAL });
  ws.getRow(r).height = 30;

  // Color scale on EUR/Monat: white → teal, proportional to value
  ws.addConditionalFormatting({
    ref: `B${dataBarStart}:B${r}`,
    rules: [{
      type: 'colorScale',
      priority: 1,
      cfvo: [{ type: 'min' }, { type: 'max' }],
      color: [{ argb: 'FFFFFFFF' }, { argb: TEAL }],
    }],
  });

  // Footer note
  r += 2;
  ws.mergeCells(`A${r}:D${r}`);
  const note = ws.getCell(`A${r}`);
  note.value = 'Hinweis: Server-Preise inkl. 64 GB Boot-Volume · ALB inkl. 2× c2i.1 Compute Nodes · Alle Preise netto zzgl. MwSt.';
  note.font = { size: 8.5, italic: true, color: { argb: 'FF888888' } };

  // ── Sheet 2: Details ───────────────────────────────────────────────────────
  const wd = wb.addWorksheet('Details', { views: [{ showGridLines: false }] });
  wd.columns = [
    { width: 20 }, // Stage
    { width: 26 }, // Service
    { width: 36 }, // Konfiguration
    { width: 18 }, // EUR/Monat
    { width: 18 }, // EUR/Jahr
    { width: 36 }, // Hinweis
  ];

  wd.mergeCells('A1:F1');
  const dt = wd.getCell('A1');
  dt.value = `${name} — Detailaufstellung`;
  dt.font = { bold: true, size: 16, color: { argb: DARK } };
  dt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LTEAL } };
  dt.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wd.getRow(1).height = 36;
  wd.getRow(2).height = 6;

  let dr = 3;
  const dh = ['Stage', 'Service', 'Konfiguration', 'EUR / Monat', 'EUR / Jahr', 'Hinweis'];
  for (let c = 1; c <= 6; c++) {
    setCell(wd, dr, c, dh[c - 1], { bold: true, size: 11, color: WHITE, bg: DARK });
  }
  wd.getRow(dr).height = 24;

  for (const group of groups) {
    for (const svc of group.services) {
      dr++;
      const bg = dr % 2 === 0 ? WHITE : LGRAY;
      setCell(wd, dr, 1, group.name, { bg });
      setCell(wd, dr, 2, svc.service_name, { bg });
      setCell(wd, dr, 3, configLabel(svc.config), { bg, align: 'left' });
      setCell(wd, dr, 4, svc.monthly_cost_eur, { bg });
      wd.getCell(dr, 4).numFmt = '€ #,##0.00';
      setCell(wd, dr, 5, svc.monthly_cost_eur * 12, { bg });
      wd.getCell(dr, 5).numFmt = '€ #,##0.00';
      setCell(wd, dr, 6, SERVICE_NOTES[svc.service_key] ?? '', { bg, align: 'left', italic: true, color: 'FF666666' });
      wd.getRow(dr).height = 18;
    }
  }

  dr += 2;
  for (let c = 1; c <= 6; c++) setCell(wd, dr, c, '', { bg: DARK });
  setCell(wd, dr, 1, 'GESAMT', { bold: true, size: 12, color: WHITE, bg: DARK });
  setCell(wd, dr, 4, total_month, { bold: true, size: 12, color: WHITE, bg: DARK });
  wd.getCell(dr, 4).numFmt = '€ #,##0.00';
  setCell(wd, dr, 5, total_year, { bold: true, size: 12, color: WHITE, bg: DARK });
  wd.getCell(dr, 5).numFmt = '€ #,##0.00';
  wd.getRow(dr).height = 26;

  return wb.xlsx.writeBuffer();
}
