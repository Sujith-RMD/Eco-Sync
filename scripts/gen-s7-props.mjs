// Generates the two S7 physical props (waste + podium) and proves the payload
// round-trips: every PNG is decoded back with jsqr and must byte-equal PAYLOAD.
import { mkdirSync, readFileSync } from "node:fs";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const PAYLOAD = "DELETED";
const OUT = "props/s7";
mkdirSync(OUT, { recursive: true });

for (const spot of ["waste", "podium"]) {
  const file = `${OUT}/qr-${spot}.png`;
  await QRCode.toFile(file, PAYLOAD, {
    errorCorrectionLevel: "M",
    margin: 4,
    scale: 16,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const png = PNG.sync.read(readFileSync(file));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!decoded) throw new Error(`${file}: nothing decodable`);
  if (decoded.data !== PAYLOAD) {
    throw new Error(`${file}: decoded ${JSON.stringify(decoded.data)} != ${JSON.stringify(PAYLOAD)}`);
  }
  console.log(`${file}: ${png.width}x${png.height}px, decodes byte-exactly to ${JSON.stringify(PAYLOAD)}`);
}
