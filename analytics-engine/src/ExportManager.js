/**
 * @file Export analytics data to JSON, CSV, Excel, and PDF-ready
 * formats. "Excel" export produces real SpreadsheetML (Excel 2003
 * XML) — a genuine, valid format Excel opens natively, not a binary
 * .xlsx (which requires a third-party library not available here).
 * "PDF Ready" produces complete, valid, print-styled HTML — the exact
 * input a PDF renderer (e.g. Puppeteer) would consume — rather than a
 * fabricated PDF binary. Both are documented explicitly so the
 * distinction is never hidden from the caller.
 * @module analytics-engine/ExportManager
 */

/**
 * @param {*} value
 * @returns {string}
 * @private
 */
function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Export an array of flat (or shallow) objects to CSV. Column headers
 * are derived from the union of keys across all rows.
 * @param {object[]} rows
 * @param {string} [delimiter=',']
 * @returns {string}
 */
export function exportToCSV(rows, delimiter = ',') {
  if (rows.length === 0) return '';
  const columns = Array.from(rows.reduce((set, row) => { Object.keys(row).forEach((k) => set.add(k)); return set; }, new Set()));
  const header = columns.map(csvEscape).join(delimiter);
  const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(delimiter));
  return [header, ...lines].join('\n');
}

/**
 * Export any JSON-serializable value to a formatted JSON string.
 * @param {*} data
 * @returns {string}
 */
export function exportToJSON(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * @param {*} value
 * @returns {string}
 * @private
 */
function xmlEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Export an array of flat objects to real SpreadsheetML (Excel 2003
 * XML) — Excel opens this format natively via double-click, no
 * import wizard required.
 * @param {object[]} rows
 * @param {string} [sheetName='Sheet1']
 * @returns {string}
 */
export function exportToExcel(rows, sheetName = 'Sheet1') {
  const columns = rows.length === 0 ? [] : Array.from(rows.reduce((set, row) => { Object.keys(row).forEach((k) => set.add(k)); return set; }, new Set()));

  const cellXml = (value) => {
    const type = typeof value === 'number' ? 'Number' : 'String';
    return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
  };

  const headerRow = `<Row>${columns.map((c) => cellXml(c)).join('')}</Row>`;
  const dataRows = rows.map((row) => `<Row>${columns.map((c) => cellXml(row[c] ?? '')).join('')}</Row>`).join('');

  return [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    `<Worksheet ss:Name="${xmlEscape(sheetName)}">`,
    '<Table>',
    headerRow,
    dataRows,
    '</Table>',
    '</Worksheet>',
    '</Workbook>',
  ].join('');
}

/**
 * Build print-ready, structured HTML for a report — exactly the
 * input a PDF renderer (Puppeteer, wkhtmltopdf, etc.) needs to
 * produce a PDF. This module does not generate a PDF binary itself
 * (that requires a rendering engine not available here).
 * @param {string} title
 * @param {Object.<string, object|object[]>} sections - section title -> a flat object (rendered as a key/value table) or array of objects (rendered as a data table).
 * @returns {string} A complete, valid HTML document.
 */
export function exportToPDFReadyHTML(title, sections) {
  const renderValue = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : xmlEscape(String(v ?? '')));

  const renderSection = (name, data) => {
    if (Array.isArray(data)) {
      if (data.length === 0) return `<h2>${xmlEscape(name)}</h2><p>No data.</p>`;
      const columns = Array.from(data.reduce((set, row) => { Object.keys(row).forEach((k) => set.add(k)); return set; }, new Set()));
      const headerCells = columns.map((c) => `<th>${xmlEscape(c)}</th>`).join('');
      const bodyRows = data.map((row) => `<tr>${columns.map((c) => `<td>${renderValue(row[c])}</td>`).join('')}</tr>`).join('');
      return `<h2>${xmlEscape(name)}</h2><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    }
    const rows = Object.entries(data).map(([k, v]) => `<tr><th>${xmlEscape(k)}</th><td>${renderValue(v)}</td></tr>`).join('');
    return `<h2>${xmlEscape(name)}</h2><table><tbody>${rows}</tbody></table>`;
  };

  const body = Object.entries(sections).map(([name, data]) => renderSection(name, data)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${xmlEscape(title)}</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; color: #1a1a1a; margin: 2cm; }
  h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 15px; margin-top: 24px; color: #333; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f2f2f2; }
  @media print { body { margin: 1.5cm; } }
</style>
</head>
<body>
<h1>${xmlEscape(title)}</h1>
${body}
</body>
</html>`;
}

export default { exportToCSV, exportToJSON, exportToExcel, exportToPDFReadyHTML };
