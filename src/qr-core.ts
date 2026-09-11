import QRCode from "qrcode";
import { DESIGN } from "./design.js";

export interface QrMatrix {
  modules: number;
  data: boolean[];
}

export function createQrMatrix(payload: string): QrMatrix {
  const qr = QRCode.create(payload, {
    errorCorrectionLevel: DESIGN.qr.errorCorrectionLevel,
  });
  return {
    modules: qr.modules.size,
    data: Array.from(qr.modules.data, Boolean),
  };
}

function matrixPath(matrix: QrMatrix, margin: number): string {
  const commands: string[] = [];
  for (let row = 0; row < matrix.modules; row += 1) {
    let column = 0;
    while (column < matrix.modules) {
      while (column < matrix.modules && !matrix.data[row * matrix.modules + column]) column += 1;
      if (column >= matrix.modules) break;
      const start = column;
      while (column < matrix.modules && matrix.data[row * matrix.modules + column]) column += 1;
      commands.push(`M${start + margin} ${row + margin}h${column - start}v1H${start + margin}z`);
    }
  }
  return commands.join("");
}

export function generateQrSvg(payload: string): string {
  const matrix = createQrMatrix(payload);
  const margin = DESIGN.qr.marginModules;
  const total = matrix.modules + margin * 2;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="#fff"/>`,
    `<path fill="#000" d="${matrixPath(matrix, margin)}"/>`,
    "</svg>",
    "",
  ].join("\n");
}

export function qrPathForSvg(payload: string): { path: string; totalModules: number } {
  const matrix = createQrMatrix(payload);
  const margin = DESIGN.qr.marginModules;
  return { path: matrixPath(matrix, margin), totalModules: matrix.modules + margin * 2 };
}
