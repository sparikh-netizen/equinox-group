import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateCard } from "../src/generator.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("production generator", () => {
  it("creates and validates the complete employee artifact set", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "equinox-card-test-"));
    temporaryDirectories.push(outputRoot);
    const result = await generateCard(
      {
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Director",
        email: "john.smith@equinoxgroup.in",
        mobile: "+91-90000-00000",
      },
      outputRoot,
    );

    expect(result.report.passed).toBe(true);
    expect(result.report.staticPixelComparison.unexpectedDifferentPixels).toBe(0);
    expect(result.report.qr.decodedPayload).toBe(result.report.qr.expectedPayload);
    expect(result.report.employeeData.missing).toEqual([]);
    const pdf = await readFile(result.files.pdf);
    expect(pdf).not.toHaveLength(0);
    expect(pdf.toString("latin1")).not.toMatch(/xmpmeta|AIPDFPrivateData|\/PieceInfo/iu);
    await expect(readFile(result.files.vcf, "utf8")).resolves.toContain("FN:John Smith");
  }, 30_000);

  it("fails before writing a card when text cannot fit the approved layout", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "equinox-card-test-"));
    temporaryDirectories.push(outputRoot);
    await expect(
      generateCard(
        {
          firstName: "Alex",
          lastName: "Smith",
          jobTitle: "WWWWWWWWWWWWWWWWWWWWWWWWWWWW",
          email: "a@b.co",
          mobile: "+91-90000-00000",
        },
        outputRoot,
      ),
    ).rejects.toThrow(/too long/iu);
  });
});
