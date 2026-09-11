import { describe, expect, it } from "vitest";
import { createQrMatrix, generateQrSvg, verifyQrPayload } from "../src/qr.js";

describe("QR generation", () => {
  it("round-trips the exact payload through an independent decoder", async () => {
    const payload = "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:John Smith\r\nEND:VCARD\r\n";
    const verified = await verifyQrPayload(payload);
    const matrix = createQrMatrix(payload);

    expect(verified.decoded).toBe(payload);
    expect(verified.modules).toBe(matrix.modules);
    expect(matrix.data).toHaveLength(matrix.modules ** 2);
  });

  it("emits a vector-only SVG with a quiet zone", () => {
    const svg = generateQrSvg("Equinox");
    expect(svg).toContain("shape-rendering=\"crispEdges\"");
    expect(svg).toContain("<path fill=\"#000\"");
    expect(svg).not.toContain("<image");
  });
});
