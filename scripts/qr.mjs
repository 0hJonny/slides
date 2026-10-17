#!/usr/bin/env node
// Replace QR markers in a talk with QR codes drawn in the theme style.
//
//   node scripts/qr.mjs talks/<talk> dist/<talk>
//
// Reads  talks/<talk>/slides.md and talks/<talk>/links.yml
// Writes dist/<talk>/slides.md   (markers replaced with inline SVG)
//        dist/<talk>/qr/<id>.svg (one file per link, for use elsewhere)
//
// links.yml:
//   pr5774: https://github.com/tinygo-org/tinygo/pull/5774   # label: "PR #5774"
//   esp-idf:
//     url: https://github.com/espressif/esp-idf
//     label: ESP-IDF
//
// Marker on a slide (one or more ids, shown in the bottom-right corner):
//   <!-- qr: pr5585 pr5602 -->
//
// Colors come from the theme CSS (--qr-bg, --qr-fg, --qr-eye),
// so the same markup works in ainews-light and ainews-navy.
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import YAML from 'yaml';

const [srcDir, outDir] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error('Usage: node scripts/qr.mjs talks/<talk> dist/<talk>');
  process.exit(1);
}

const MARKER = /<!--\s*qr:\s*([^>]*?)\s*-->/g;
const slides = fs.readFileSync(path.join(srcDir, 'slides.md'), 'utf8');
const linksFile = path.join(srcDir, 'links.yml');
const links = fs.existsSync(linksFile)
  ? YAML.parse(fs.readFileSync(linksFile, 'utf8')) ?? {}
  : {};

// "PR #5774" / "issue #5767" for GitHub links, the host name otherwise
function autoLabel(url) {
  const m = url.match(/github\.com\/[^/]+\/[^/]+\/(pull|issues)\/(\d+)/);
  if (m) return m[1] === 'pull' ? `PR #${m[2]}` : `issue #${m[2]}`;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function entry(id) {
  const v = links[id];
  if (v === undefined) return null;
  const url = typeof v === 'string' ? v : v.url;
  if (!url) throw new Error(`links.yml: "${id}" has no url`);
  return { url, label: (typeof v === 'object' && v.label) || autoLabel(url) };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One QR code as a single-line SVG (markdown-it breaks multi-line HTML on blank lines)
function qrSvg(url, label) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const q = 2; // quiet zone in modules; the card adds a little more
  const dim = n + q * 2;
  const isEye = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  const parts = [];
  parts.push(`<rect width="${dim}" height="${dim}" rx="2.5" style="fill:var(--qr-bg,#ffffff)"/>`);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!modules.get(r, c) || isEye(r, c)) continue;
      parts.push(`<rect x="${c + q + 0.06}" y="${r + q + 0.06}" width="0.88" height="0.88" rx="0.3"/>`);
    }
  }
  // Finder patterns ("eyes"): rounded ring + rounded center, in the accent color
  const eyes = [[0, 0], [0, n - 7], [n - 7, 0]].map(([r, c]) => {
    const x = c + q, y = r + q;
    return `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.2" fill="none" stroke-width="1" style="stroke:var(--qr-eye,#6941c6)"/>`
      + `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.6" style="fill:var(--qr-eye,#6941c6)"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" role="img" aria-label="${esc(label)}">`
    + parts[0]
    + `<g style="fill:var(--qr-fg,#1a1a1a)">${parts.slice(1).join('')}</g>`
    + eyes.join('')
    + `</svg>`;
}

fs.mkdirSync(path.join(outDir, 'qr'), { recursive: true });
const used = new Set();
const missing = [];

const out = slides.replace(MARKER, (_, ids) => {
  const figures = ids.split(/[\s,]+/).filter(Boolean).map((id) => {
    const e = entry(id);
    if (!e) { missing.push(id); return ''; }
    used.add(id);
    const svg = qrSvg(e.url, e.label);
    fs.writeFileSync(path.join(outDir, 'qr', `${id}.svg`), svg + '\n');
    return `<a class="qr" href="${esc(e.url)}">${svg}<span class="qr-label">${esc(e.label)}</span></a>`;
  });
  return `<div class="qr-corner">${figures.join('')}</div>`;
});

if (missing.length) {
  console.error(`${srcDir}: unknown QR id(s): ${[...new Set(missing)].join(', ')} — add them to links.yml`);
  process.exit(1);
}
const unused = Object.keys(links).filter((id) => !used.has(id));
if (unused.length) console.warn(`${srcDir}: links.yml entries not used on any slide: ${unused.join(', ')}`);

fs.writeFileSync(path.join(outDir, 'slides.md'), out);
