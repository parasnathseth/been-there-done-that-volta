// Loads Volta-demo-data-pack.csv (made-up founders supplied by Volta) and merges the
// invented extras from pack-overlay.js.
import { readFileSync } from 'node:fs';
import { overlay } from './pack-overlay.js';

// Small CSV parser: handles quoted fields with commas and doubled quotes.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); if (row.some((v) => v.trim() !== '')) rows.push(row); }
  return rows;
}

const text = readFileSync(new URL('../Volta-demo-data-pack.csv', import.meta.url), 'utf8');
const [header, ...lines] = parseCsv(text);

export const people = lines.map((cells) => {
  const r = Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? '').trim()]));
  const extra = overlay[r.Name];
  if (!extra) throw new Error(`No overlay entry for ${r.Name} in data/pack-overlay.js`);
  return {
    name: r.Name,
    company: r.Company,
    title: r.Role,
    location: r.Location,
    comesIn: r['Comes into Volta'],
    stuckOn: r['Stuck on'],
    livedThrough: r['Lived through'],
    canHelpWith: r['Can help with'],
    ...extra,
  };
});

/** Short id for a person, e.g. 'leah-morin'. */
export const keyOf = (name) => name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
