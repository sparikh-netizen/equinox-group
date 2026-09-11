import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PATHS, SOURCE_HASHES } from "./config.js";
import { normalizeEmployee, type EmployeeInput } from "./employee.js";
import { requireFile, sha256File } from "./fs-utils.js";
import { generatePrintPdf } from "./pdf.js";
import { generateQrSvg, verifyQrPayload } from "./qr.js";
import { generateCardSvg } from "./svg.js";
import { validateOutput, type ValidationReport } from "./validation.js";
import { generateVCard } from "./vcard.js";

export interface GenerationResult {
  outputDirectory: string;
  report: ValidationReport;
  files: Record<string, string>;
}

export async function generateCard(
  input: EmployeeInput,
  outputRoot = PATHS.outputDirectory,
): Promise<GenerationResult> {
  await Promise.all([
    requireFile(PATHS.staticTemplatePdf),
    requireFile(PATHS.regularFont),
    requireFile(PATHS.boldFont),
    requireFile(PATHS.extraBoldFont),
  ]);
  const templateHash = await sha256File(PATHS.staticTemplatePdf);
  if (templateHash !== SOURCE_HASHES.staticTemplatePdf) {
    throw new Error("The approved static template has changed; review it and update the pinned hash");
  }

  const employee = normalizeEmployee(input);
  const vcard = generateVCard(employee);
  await verifyQrPayload(vcard);

  const outputDirectory = path.resolve(outputRoot, employee.fileSlug);
  await mkdir(outputDirectory, { recursive: true });
  const files = {
    pdf: path.join(outputDirectory, `${employee.fileStem}-VisitingCard-PRINT.pdf`),
    cardSvg: path.join(outputDirectory, `${employee.fileStem}-VisitingCard.svg`),
    vcf: path.join(outputDirectory, `${employee.fileStem}.vcf`),
    qrSvg: path.join(outputDirectory, `${employee.fileStem}-QR.svg`),
    report: path.join(outputDirectory, "validation-report.json"),
  };

  await writeFile(files.vcf, vcard);
  await writeFile(files.qrSvg, generateQrSvg(vcard));
  await generateCardSvg(employee, vcard, files.cardSvg);
  const pdfResult = await generatePrintPdf(employee, vcard, files.pdf);
  const artifactFiles = {
    pdf: files.pdf,
    cardSvg: files.cardSvg,
    vcf: files.vcf,
    qrSvg: files.qrSvg,
  };
  const report = await validateOutput({
    employee,
    vcard,
    pdfResult,
    outputDirectory,
    files: artifactFiles,
  });
  await writeFile(files.report, `${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) {
    throw new Error(`Validation failed. See ${files.report}`);
  }
  return { outputDirectory, report, files };
}

export async function loadEmployeeInput(filePath: string): Promise<EmployeeInput> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as EmployeeInput;
  } catch (error) {
    throw new Error(`Could not read employee JSON at ${filePath}: ${error instanceof Error ? error.message : error}`);
  }
}
