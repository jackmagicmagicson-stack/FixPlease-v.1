import ExcelJS from "exceljs";
import { saveBlobAsFile } from "./saveDownload";
import type { StatsResponse } from "./types";

const FONT = "Segoe UI, Arial, sans-serif";
const TEXT = "#0d1a27";
const MUTED = "#5a6878";
const ACCENT = "#5eb0f0";
const SUCCESS = "#3ecfaa";
const WARNING = "#e8b84a";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFC8D4E0" } },
  left: { style: "thin", color: { argb: "FFC8D4E0" } },
  bottom: { style: "thin", color: { argb: "FFC8D4E0" } },
  right: { style: "thin", color: { argb: "FFC8D4E0" } },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8F2FC" },
};

function createCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas не поддерживается");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  return ctx;
}

function drawTitle(ctx: CanvasRenderingContext2D, title: string) {
  ctx.fillStyle = TEXT;
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(title, 16, 28);
}

function truncateLabel(label: string, max = 14): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function renderBarChart(
  items: { label: string; value: number }[],
  title: string,
  color = ACCENT,
): string {
  if (items.length === 0) return "";

  const width = 560;
  const height = 300;
  const ctx = createCanvas(width, height);
  drawTitle(ctx, title);

  const top = 44;
  const bottom = height - 52;
  const chartHeight = bottom - top;
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const slot = (width - 48) / items.length;
  const barW = Math.min(44, slot - 16);

  items.forEach((item, i) => {
    const x = 24 + i * slot + (slot - barW) / 2;
    const h = (item.value / maxVal) * chartHeight;
    const y = bottom - h;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = TEXT;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(item.value), x + barW / 2, Math.max(y - 6, top + 12));

    ctx.fillStyle = MUTED;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(truncateLabel(item.label), x + barW / 2, height - 28);
  });

  return ctx.canvas.toDataURL("image/png");
}

function renderGroupedBarChart(
  items: { label: string; assigned: number; closed: number }[],
  title: string,
): string {
  if (items.length === 0) return "";

  const width = 560;
  const height = 320;
  const ctx = createCanvas(width, height);
  drawTitle(ctx, title);

  const top = 52;
  const bottom = height - 52;
  const chartHeight = bottom - top;
  const maxVal = Math.max(...items.flatMap((i) => [i.assigned, i.closed]), 1);
  const slot = (width - 48) / items.length;
  const groupW = Math.min(56, slot - 12);
  const barW = (groupW - 6) / 2;

  ctx.font = `11px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillStyle = ACCENT;
  ctx.fillRect(width - 150, 14, 10, 10);
  ctx.fillStyle = TEXT;
  ctx.fillText("Назначено", width - 134, 23);
  ctx.fillStyle = SUCCESS;
  ctx.fillRect(width - 150, 30, 10, 10);
  ctx.fillStyle = TEXT;
  ctx.fillText("Закрыто", width - 134, 39);

  items.forEach((item, i) => {
    const baseX = 24 + i * slot + (slot - groupW) / 2;
    const pairs: [number, string][] = [
      [item.assigned, ACCENT],
      [item.closed, SUCCESS],
    ];

    pairs.forEach(([value, color], j) => {
      const x = baseX + j * (barW + 6);
      const h = (value / maxVal) * chartHeight;
      const y = bottom - h;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barW, h);
      ctx.fillStyle = TEXT;
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(String(value), x + barW / 2, Math.max(y - 4, top + 10));
    });

    ctx.fillStyle = MUTED;
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(truncateLabel(item.label, 10), baseX + groupW / 2, height - 28);
  });

  return ctx.canvas.toDataURL("image/png");
}

function renderDonutChart(
  segments: { label: string; value: number; color: string }[],
  title: string,
): string {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return "";

  const width = 400;
  const height = 300;
  const ctx = createCanvas(width, height);
  drawTitle(ctx, title);

  const cx = 130;
  const cy = 165;
  const outer = 78;
  const inner = 48;
  let start = -Math.PI / 2;

  segments.forEach((seg) => {
    const angle = (seg.value / total) * Math.PI * 2;
    const end = start + angle;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, start, end);
    ctx.arc(cx, cy, inner, end, start, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    start = end;
  });

  ctx.fillStyle = TEXT;
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(String(total), cx, cy + 6);

  ctx.textAlign = "left";
  ctx.font = `12px ${FONT}`;
  segments.forEach((seg, i) => {
    const y = 70 + i * 22;
    ctx.fillStyle = seg.color;
    ctx.fillRect(230, y - 10, 12, 12);
    ctx.fillStyle = TEXT;
    const pct = ((seg.value / total) * 100).toFixed(0);
    ctx.fillText(`${seg.label}: ${seg.value} (${pct}%)`, 250, y);
  });

  return ctx.canvas.toDataURL("image/png");
}

function styleDataRow(row: ExcelJS.Row, cols: number) {
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.border = THIN_BORDER;
  }
}

function styleHeaderRow(row: ExcelJS.Row, cols: number) {
  row.font = { bold: true };
  for (let c = 1; c <= cols; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
  }
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/\w+;base64,/, "");
}

function embedChart(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  dataUrl: string,
  anchorRow: number,
  width: number,
  height: number,
) {
  const imageId = workbook.addImage({
    base64: dataUrlToBase64(dataUrl),
    extension: "png",
  });
  sheet.addImage(imageId, {
    tl: { col: 0, row: anchorRow },
    ext: { width, height },
  });
}

function rowsForImage(height: number): number {
  return Math.ceil(height / 15) + 2;
}

async function buildWorkbook(stats: StatsResponse, periodLabel: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FixPlease";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Отчёт", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [{ width: 30 }, { width: 14 }, { width: 14 }];

  const titleRow = sheet.addRow([`FixPlease — отчёт (${periodLabel})`]);
  titleRow.font = { bold: true, size: 14 };
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 2);

  const summary: [string, string | number][] = [
    ["Всего заявок", stats.total_tickets],
    ["Открытых", stats.open_tickets],
    ["Закрытых", stats.closed_tickets],
    ["Средняя реакция (мин)", stats.avg_first_response_minutes?.toFixed(1) ?? "—"],
    ["Доля закрытых (%)", stats.close_rate_percent.toFixed(1)],
  ];
  for (const [label, value] of summary) {
    const row = sheet.addRow([label, value]);
    styleDataRow(row, 2);
  }

  sheet.addRow([]);

  const catHeader = sheet.addRow(["Категория", "Количество"]);
  styleHeaderRow(catHeader, 2);
  for (const c of stats.by_category) {
    const row = sheet.addRow([c.category_name, c.count]);
    styleDataRow(row, 2);
  }

  sheet.addRow([]);

  const adminHeader = sheet.addRow(["Администратор", "Назначено", "Закрыто"]);
  styleHeaderRow(adminHeader, 3);
  for (const a of stats.by_admin) {
    const row = sheet.addRow([a.admin_name, a.assigned_count, a.closed_count]);
    styleDataRow(row, 3);
  }

  const statusChart = renderDonutChart(
    [
      { label: "Открытые", value: stats.open_tickets, color: WARNING },
      { label: "Закрытые", value: stats.closed_tickets, color: SUCCESS },
    ],
    "Открытые и закрытые заявки",
  );
  if (statusChart) {
    const labelRow = sheet.addRow(["График: статус заявок"]);
    labelRow.font = { bold: true };
    embedChart(workbook, sheet, statusChart, labelRow.number, 400, 300);
    for (let i = 0; i < rowsForImage(300); i++) sheet.addRow([]);
  }

  const categoryChart = renderBarChart(
    stats.by_category.map((c) => ({ label: c.category_name, value: c.count })),
    "Заявки по категориям",
  );
  if (categoryChart) {
    const labelRow = sheet.addRow(["График: по категориям"]);
    labelRow.font = { bold: true };
    embedChart(workbook, sheet, categoryChart, labelRow.number, 560, 300);
    for (let i = 0; i < rowsForImage(300); i++) sheet.addRow([]);
  }

  const adminChart = renderGroupedBarChart(
    stats.by_admin.map((a) => ({
      label: a.admin_name,
      assigned: a.assigned_count,
      closed: a.closed_count,
    })),
    "Нагрузка по администраторам",
  );
  if (adminChart) {
    const labelRow = sheet.addRow(["График: по администраторам"]);
    labelRow.font = { bold: true };
    embedChart(workbook, sheet, adminChart, labelRow.number, 560, 320);
    for (let i = 0; i < rowsForImage(320); i++) sheet.addRow([]);
  }

  return workbook;
}

/** Экспорт отчёта в настоящий Excel (.xlsx) с таблицами и встроенными графиками. */
export async function exportStatsToExcel(
  stats: StatsResponse,
  periodLabel: string,
): Promise<{ saved: boolean; path?: string }> {
  const date = new Date().toISOString().slice(0, 10);
  const workbook = await buildWorkbook(stats, periodLabel);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return saveBlobAsFile(blob, `fixplease-otchet-${date}.xlsx`, [
    { name: "Excel", extensions: ["xlsx"] },
  ]);
}
