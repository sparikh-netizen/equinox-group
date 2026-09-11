import { spawnSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import jsQR from "jsqr";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { DESIGN, PAGE, PATHS, VALIDATION } from "./config.js";
import type { Employee } from "./employee.js";
import type { PdfGenerationResult } from "./pdf.js";

const decodeQr = jsQR as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: { inversionAttempts: "attemptBoth" },
) => { data: string } | null;

interface Check {
  passed: boolean;
  message?: string;
}

export interface ValidationReport {
  passed: boolean;
  generatedAt: string;
  employee: {
    fullName: string;
    jobTitle: string;
    email: string;
    mobile: string;
  };
  files: Record<string, Check & { bytes: number }>;
  document: Check & {
    pageCount: number;
    pageSizePoints: { width: number; height: number };
    trimBoxPoints: { x: number; y: number; width: number; height: number };
  };
  employeeData: Check & { missing: string[] };
  textFit: Check & { fields: PdfGenerationResult["textFit"] };
  qr: Check & {
    expectedPayload: string;
    decodedPayload: string | null;
    modules: number;
    moduleSizeMm: number;
    dotsAt300Dpi: number;
  };
  staticPixelComparison: Check & {
    dpi: number;
    comparedPixels: number;
    unexpectedDifferentPixels: number;
    masks: typeof DESIGN.validationMasks;
  };
}

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) throw new Error(`${command} is required but could not be started: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

function renderPdf(pdfPath: string, prefix: string): string {
  run("pdftoppm", ["-r", String(VALIDATION.dpi), "-png", "-singlefile", pdfPath, prefix]);
  return `${prefix}.png`;
}

function isMasked(x: number, y: number, imageWidth: number, imageHeight: number): boolean {
  const sx = imageWidth / PAGE.width;
  const sy = imageHeight / PAGE.height;
  return DESIGN.validationMasks.some((mask) => {
    const left = Math.floor(mask.x * sx);
    const right = Math.ceil((mask.x + mask.width) * sx);
    const top = Math.floor((PAGE.height - mask.y - mask.height) * sy);
    const bottom = Math.ceil((PAGE.height - mask.y) * sy);
    return x >= left && x < right && y >= top && y < bottom;
  });
}

function compareStaticPixels(reference: PNG, generated: PNG): {
  diff: PNG;
  comparedPixels: number;
  unexpectedDifferentPixels: number;
} {
  if (reference.width !== generated.width || reference.height !== generated.height) {
    throw new Error("Reference and generated render dimensions differ");
  }
  const diff = new PNG({ width: reference.width, height: reference.height });
  const rawDiff = new PNG({ width: reference.width, height: reference.height });
  pixelmatch(reference.data, generated.data, rawDiff.data, reference.width, reference.height, {
    threshold: 0,
    includeAA: true,
  });

  let comparedPixels = 0;
  let unexpectedDifferentPixels = 0;
  for (let y = 0; y < reference.height; y += 1) {
    for (let x = 0; x < reference.width; x += 1) {
      const offset = (y * reference.width + x) * 4;
      if (isMasked(x, y, reference.width, reference.height)) {
        diff.data[offset] = generated.data[offset];
        diff.data[offset + 1] = generated.data[offset + 1];
        diff.data[offset + 2] = generated.data[offset + 2];
        diff.data[offset + 3] = 90;
        continue;
      }
      comparedPixels += 1;
      const different =
        reference.data[offset] !== generated.data[offset] ||
        reference.data[offset + 1] !== generated.data[offset + 1] ||
        reference.data[offset + 2] !== generated.data[offset + 2] ||
        reference.data[offset + 3] !== generated.data[offset + 3];
      if (different) unexpectedDifferentPixels += 1;
      diff.data[offset] = different ? 255 : reference.data[offset];
      diff.data[offset + 1] = different ? 0 : reference.data[offset + 1];
      diff.data[offset + 2] = different ? 0 : reference.data[offset + 2];
      diff.data[offset + 3] = 255;
    }
  }
  return { diff, comparedPixels, unexpectedDifferentPixels };
}

function decodeQrFromRenderedPdf(rendered: PNG): string | null {
  const sx = rendered.width / PAGE.width;
  const sy = rendered.height / PAGE.height;
  const padding = Math.ceil(4 * sx);
  const left = Math.max(0, Math.floor(DESIGN.qr.x * sx) - padding);
  const top = Math.max(0, Math.floor((PAGE.height - DESIGN.qr.y - DESIGN.qr.size) * sy) - padding);
  const right = Math.min(rendered.width, Math.ceil((DESIGN.qr.x + DESIGN.qr.size) * sx) + padding);
  const bottom = Math.min(rendered.height, Math.ceil((PAGE.height - DESIGN.qr.y) * sy) + padding);
  const width = right - left;
  const height = bottom - top;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = ((top + y) * rendered.width + left + x) * 4;
      const targetOffset = (y * width + x) * 4;
      pixels.set(rendered.data.subarray(sourceOffset, sourceOffset + 4), targetOffset);
    }
  }
  return decodeQr(pixels, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

function parsePdfInfo(output: string): {
  pageCount: number;
  pageSize: { width: number; height: number };
  trimBox: { x: number; y: number; width: number; height: number };
} {
  const pages = output.match(/^Pages:\s+(\d+)/mu);
  const size = output.match(/^Page size:\s+([\d.]+) x ([\d.]+) pts/mu);
  const trim = output.match(/^TrimBox:\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/mu);
  if (!pages || !size || !trim) throw new Error("Could not parse pdfinfo output");
  const x1 = Number(trim[1]);
  const y1 = Number(trim[2]);
  const x2 = Number(trim[3]);
  const y2 = Number(trim[4]);
  return {
    pageCount: Number(pages[1]),
    pageSize: { width: Number(size[1]), height: Number(size[2]) },
    trimBox: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
  };
}

export async function validateOutput(options: {
  employee: Employee;
  vcard: string;
  pdfResult: PdfGenerationResult;
  outputDirectory: string;
  files: Record<string, string>;
}): Promise<ValidationReport> {
  const validationDirectory = path.join(options.outputDirectory, "validation");
  await mkdir(validationDirectory, { recursive: true });
  const referencePngPath = renderPdf(PATHS.staticTemplatePdf, path.join(validationDirectory, "reference"));
  const generatedPngPath = renderPdf(options.files.pdf, path.join(validationDirectory, "generated"));
  const referencePng = PNG.sync.read(await readFile(referencePngPath));
  const generatedPng = PNG.sync.read(await readFile(generatedPngPath));
  const comparison = compareStaticPixels(referencePng, generatedPng);
  await writeFile(path.join(validationDirectory, "diff.png"), PNG.sync.write(comparison.diff));

  const decodedPayload = decodeQrFromRenderedPdf(generatedPng);
  const extractedText = run("pdftotext", [options.files.pdf, "-"]);
  const expectedText = [
    options.employee.fullName,
    options.employee.jobTitle,
    options.employee.email,
    options.employee.displayMobile,
  ];
  const missing = expectedText.filter((value) => !extractedText.includes(value));
  const info = parsePdfInfo(run("pdfinfo", ["-box", options.files.pdf]));
  const close = (actual: number, expected: number) =>
    Math.abs(actual - expected) <= VALIDATION.dimensionTolerancePoints;
  const documentPassed =
    info.pageCount === 1 &&
    close(info.pageSize.width, PAGE.width) &&
    close(info.pageSize.height, PAGE.height) &&
    close(info.trimBox.x, PAGE.trimBox.x) &&
    close(info.trimBox.y, PAGE.trimBox.y) &&
    close(info.trimBox.width, PAGE.trimBox.width) &&
    close(info.trimBox.height, PAGE.trimBox.height);

  const fileChecks: ValidationReport["files"] = {};
  for (const [name, filePath] of Object.entries(options.files)) {
    const bytes = (await stat(filePath)).size;
    fileChecks[name] = { passed: bytes > 0, bytes, message: bytes > 0 ? undefined : "File is empty" };
  }
  const qrPassed = decodedPayload === options.vcard;
  const textFitPassed = options.pdfResult.textFit.every((field) => field.passed);
  const staticPassed = comparison.unexpectedDifferentPixels === 0;
  const passed =
    Object.values(fileChecks).every((check) => check.passed) &&
    documentPassed &&
    missing.length === 0 &&
    textFitPassed &&
    qrPassed &&
    staticPassed;

  return {
    passed,
    generatedAt: new Date().toISOString(),
    employee: {
      fullName: options.employee.fullName,
      jobTitle: options.employee.jobTitle,
      email: options.employee.email,
      mobile: options.employee.displayMobile,
    },
    files: fileChecks,
    document: {
      passed: documentPassed,
      pageCount: info.pageCount,
      pageSizePoints: info.pageSize,
      trimBoxPoints: info.trimBox,
    },
    employeeData: { passed: missing.length === 0, missing },
    textFit: { passed: textFitPassed, fields: options.pdfResult.textFit },
    qr: {
      passed: qrPassed,
      expectedPayload: options.vcard,
      decodedPayload,
      modules: options.pdfResult.qrModules,
      moduleSizeMm: options.pdfResult.qrModuleSizeMm,
      dotsAt300Dpi: options.pdfResult.qrDotsAt300Dpi,
    },
    staticPixelComparison: {
      passed: staticPassed,
      dpi: VALIDATION.dpi,
      comparedPixels: comparison.comparedPixels,
      unexpectedDifferentPixels: comparison.unexpectedDifferentPixels,
      masks: DESIGN.validationMasks,
    },
  };
}
