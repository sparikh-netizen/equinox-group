import { describe, expect, it } from "vitest";
import { normalizeEmployee } from "../src/employee.js";
import { createQrMatrix, generateQrSvg, getQrPrintMetrics, verifyQrPayload } from "../src/qr.js";
import { generateVCard } from "../src/vcard.js";

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

  it("keeps the employee contact QR sparse enough for business-card printing", () => {
    const payload = generateVCard(
      normalizeEmployee({
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Director",
        email: "john.smith@equinoxgroup.in",
        mobile: "+91-90000-00000",
      }),
    );
    const matrix = createQrMatrix(payload);
    const metrics = getQrPrintMetrics(matrix.modules);

    expect(matrix.modules).toBe(41);
    expect(metrics.dotsAt300Dpi).toBeGreaterThanOrEqual(4);
  });

  it("rejects payloads that would make the printed modules too small", () => {
    expect(() => createQrMatrix(`BEGIN:VCARD\r\nNOTE:${"x".repeat(500)}\r\nEND:VCARD\r\n`)).toThrow(/too dense/iu);
  });
});
