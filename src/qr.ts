import jsQR from "jsqr";
import { PNG } from "pngjs";
import QRCode from "qrcode";
import { DESIGN } from "./design.js";
import { createQrMatrix } from "./qr-core.js";

export { createQrMatrix, generateQrSvg, qrPathForSvg } from "./qr-core.js";

const decodeQr = jsQR as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: { inversionAttempts: "attemptBoth" },
) => { data: string } | null;

export async function verifyQrPayload(payload: string): Promise<{ modules: number; decoded: string }> {
  const pngBytes = await QRCode.toBuffer(payload, {
    type: "png",
    errorCorrectionLevel: DESIGN.qr.errorCorrectionLevel,
    margin: DESIGN.qr.marginModules,
    scale: 10,
  });
  const png = PNG.sync.read(pngBytes);
  const decoded = decodeQr(new Uint8ClampedArray(png.data), png.width, png.height, {
    inversionAttempts: "attemptBoth",
  });
  if (!decoded) throw new Error("Generated QR could not be decoded");
  if (decoded.data !== payload) throw new Error("Generated QR payload does not match the vCard");
  return { modules: createQrMatrix(payload).modules, decoded: decoded.data };
}
