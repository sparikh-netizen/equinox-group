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

  it("keeps the complete employee contact QR within the approved 73-module master capacity", () => {
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

    expect(matrix.modules).toBeLessThanOrEqual(73);
    expect(metrics.dotsAt300Dpi).toBeGreaterThan(0);
  });

  it("accepts the reported long names and titles", () => {
    const examples = [
      normalizeEmployee({
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Sr. Manager - Sales (North & East India)",
        email: "john.smith@equinoxgroup.in",
        mobile: "+91-90000-00000",
      }),
      normalizeEmployee({
        firstName: "Mohommed Azharuddin",
        lastName: "Shaikh",
        jobTitle: "Executive - Employee Relations & Admin",
        email: "mohommed.shaikh@equinoxgroup.in",
        mobile: "+91-90000-00000",
      }),
    ];
    expect(examples.map((employee) => createQrMatrix(generateVCard(employee)).modules)).toEqual([73, 73]);
  });

  it("rejects payloads beyond the approved master capacity", () => {
    expect(() => createQrMatrix(`BEGIN:VCARD\r\nNOTE:${"x".repeat(500)}\r\nEND:VCARD\r\n`)).toThrow(/master QR capacity/iu);
  });
});
