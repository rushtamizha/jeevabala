import "server-only";
import QRCode from "qrcode";

export type QrMatrix = { size: number; path: string };

/**
 * Encode text as a QR code and return a compact SVG path (one "M x y h1v1h-1z" per
 * dark module run). Rendered by <QrSvg/> without innerHTML or data: URLs.
 */
export function qrPath(text: string, ecc: "L" | "M" | "Q" | "H" = "M"): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecc });
  const size = qr.modules.size;
  const data = qr.modules.data;
  let path = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (data[y * size + x]) {
        let run = 1;
        while (x + run < size && data[y * size + x + run]) run++;
        path += `M${x} ${y}h${run}v1h-${run}z`;
        x += run;
      } else {
        x++;
      }
    }
  }
  return { size, path };
}
