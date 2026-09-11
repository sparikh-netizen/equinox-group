import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { normalizeIdCardEmployee } from "../src/id-card.js";
import { ID_PAGE } from "../src/id-design.js";
import { generateIdPdfBytes } from "../src/id-pdf-core.js";

const sample = {
  firstName: "John",
  lastName: "Smith",
  jobTitle: "Director",
  employeeId: "1001",
  mobile: "+91-90000-00000",
  bloodGroup: "O+" as const,
  emergencyContact: "+91-90000-00001",
  dateOfBirth: "1990-01-01",
};

describe("ID card generator", () => {
  it("normalizes the reference fields and display formatting", () => {
    const employee = normalizeIdCardEmployee(sample);
    expect(employee.fullName).toBe("John Smith");
    expect(employee.displayMobile).toBe("+91-90000-00000");
    expect(employee.displayEmergencyContact).toBe("+91-90000-00001");
    expect(employee.displayDateOfBirth).toBe("01-Jan-1990");
  });

  it("creates a private-metadata-free 54 × 85 mm print PDF", async () => {
    const [staticTemplate, topLogoOverlay, regularFont, extraBoldFont, photoJpeg] = await Promise.all([
      readFile("template/id-static-template.pdf"),
      readFile("template/id-top-logo-overlay.pdf"),
      readFile("template/fonts/Manrope-Regular.ttf"),
      readFile("template/fonts/Manrope-ExtraBold.ttf"),
      readFile("tests/fixtures/sample-id-photo.jpg"),
    ]);
    const output = await generateIdPdfBytes(normalizeIdCardEmployee(sample), {
      staticTemplate,
      topLogoOverlay,
      regularFont,
      extraBoldFont,
      photoJpeg,
    });
    expect(output.bytes.length).toBeGreaterThan(photoJpeg.length);
    expect(output.textFit.every(({ passed }) => passed)).toBe(true);
    expect(ID_PAGE).toMatchObject({ widthMm: 54, heightMm: 85 });
    const raw = Buffer.from(output.bytes).toString("latin1");
    const formerName = ["An", "eri"].join("");
    const formerPathOwner = ["anj", "aniparikh"].join("");
    expect(raw).not.toMatch(new RegExp(`xmpmeta|AIPDFPrivateData|/PieceInfo|${formerName}|${formerPathOwner}`, "iu"));
  });

  it("rejects invalid blood groups and dates", () => {
    expect(() => normalizeIdCardEmployee({ ...sample, bloodGroup: "X+" as "O+" })).toThrow();
    expect(() => normalizeIdCardEmployee({ ...sample, dateOfBirth: "1990-02-31" })).toThrow(/calendar date/iu);
  });
});
