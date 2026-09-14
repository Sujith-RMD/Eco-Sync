// Builds props/s7/S7-PRINT.html — one self-contained, print-ready sheet.
// Both QRs are embedded as base64 so the file opens anywhere with no assets.
import { readFileSync, writeFileSync } from "node:fs";

const b64 = (p) => readFileSync(p).toString("base64");
const waste = b64("props/s7/qr-waste.png");
const podium = b64("props/s7/qr-podium.png");

const card = (img, spot, note) => `
  <section class="card">
    <div class="head">HIDE AT: <b>${spot}</b></div>
    <img src="data:image/png;base64,${img}" alt="${spot} QR code" />
    <div class="foot">${note}</div>
  </section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>S7 — Hidden QR Codes (print sheet)</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .hint { font-size: 13px; color: #555; margin: 0 0 20px; }
  .sheet { display: flex; gap: 24px; justify-content: center; }
  .card { border: 2px dashed #999; padding: 16px; text-align: center; width: 240px;
          page-break-inside: avoid; }
  .head { font-size: 13px; letter-spacing: .04em; margin-bottom: 12px; }
  .head b { font-size: 15px; }
  img { width: 200px; height: 200px; image-rendering: pixelated; }
  .foot { font-size: 11px; color: #666; margin-top: 12px; }
  @media print { body { padding: 0; } .card { border-color: #333; } }
</style>
</head>
<body>
  <h1>ECO-SYNC: THE BREACH — Puzzle S7 &laquo;Hidden QR Codes&raquo;</h1>
  <p class="hint">Cut along the dashes. Tape one code near the room's <b>waste</b>, the
  other near the <b>podium</b>. Both scan to the same token; a team that finds and scans
  <i>both</i> reads the reveal. Keep this sheet away from players.</p>
  <div class="sheet">
    ${card(waste, "WASTE", "Near the waste bin / recycling")}
    ${card(podium, "PODIUM", "On or behind the podium")}
  </div>
</body>
</html>
`;

writeFileSync("props/s7/S7-PRINT.html", html);
console.log("props/s7/S7-PRINT.html written (%d bytes).", html.length);
