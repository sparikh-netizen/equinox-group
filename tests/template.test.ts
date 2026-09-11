import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PATHS, SOURCE_HASHES } from "../src/config.js";
import { sha256File } from "../src/fs-utils.js";

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

describe("approved templates", () => {
  it("pins the immutable source files by SHA-256", async () => {
    await expect(sha256File(PATHS.staticTemplatePdf)).resolves.toBe(SOURCE_HASHES.staticTemplatePdf);
  });

  it("contains no prior employee text, metadata, or raster QR in the static template", async () => {
    const text = run("pdftotext", [PATHS.staticTemplatePdf, "-"]);
    const images = run("pdfimages", ["-list", PATHS.staticTemplatePdf]);
    const raw = await readFile(PATHS.staticTemplatePdf, "latin1");

    expect(raw).not.toMatch(/xmpmeta|AIPDFPrivateData|\/PieceInfo/iu);
    expect(text).toContain("EQUINOX SOLUTIONS");
    expect(images.trim().split("\n")).toHaveLength(2);
  });
});
