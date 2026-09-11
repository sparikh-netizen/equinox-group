import { readFile, writeFile } from "node:fs/promises";
import { PATHS } from "./config.js";
import type { Employee } from "./employee.js";
import { generatePrintPdfBytes, type PdfGenerationResult } from "./pdf-core.js";

export type { PdfGenerationResult, TextFitResult } from "./pdf-core.js";

export async function generatePrintPdf(
  employee: Employee,
  vcard: string,
  outputPath: string,
): Promise<PdfGenerationResult> {
  const generated = await generatePrintPdfBytes(employee, vcard, {
    staticTemplate: await readFile(PATHS.staticTemplatePdf),
    regularFont: await readFile(PATHS.regularFont),
    extraBoldFont: await readFile(PATHS.extraBoldFont),
  });
  await writeFile(outputPath, generated.bytes);
  return generated.result;
}
