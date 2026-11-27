/** RFC 4180 CSV parsing and writing. No dependencies, so the data files stay plain and predictable. */

/** Parse CSV text into rows of cells. Handles quotes, escaped quotes, CRLF/LF and a leading BOM. */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
      i++;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      cell += ch;
      i++;
    }
  }
  if (quoted) throw new Error('CSV has an unclosed quote');
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully blank lines (e.g. a trailing newline or empty rows from spreadsheet apps).
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function quote(cell: string): string {
  return /[",\r\n]|^\s|\s$/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function stringifyCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quote).join(',')).join('\n') + '\n';
}

/** Parse CSV with a header row into records keyed by column name. */
export function parseCsvRecords(text: string): { header: string[]; records: Record<string, string>[] } {
  const [header = [], ...rest] = parseCsv(text);
  const cleanHeader = header.map((h) => h.trim());
  const records = rest.map((cells) => {
    const rec: Record<string, string> = {};
    cleanHeader.forEach((h, idx) => (rec[h] = cells[idx] ?? ''));
    return rec;
  });
  return { header: cleanHeader, records };
}

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Spreadsheet apps run cells starting with = + - @ as formulas. For files people download and open,
 * prefix such cells with an apostrophe (unless it's a plain number like -5).
 */
export function spreadsheetSafe(cell: string): string {
  if (FORMULA_START.test(cell) && !/^-?\d+(\.\d+)?$/.test(cell)) return `'${cell}`;
  return cell;
}

/** Undo spreadsheetSafe when a downloaded file is imported again. */
export function fromSpreadsheet(cell: string): string {
  return cell.startsWith("'") && FORMULA_START.test(cell.slice(1)) ? cell.slice(1) : cell;
}
