import { readFile, writeFile } from "node:fs/promises";
import { PATHS } from "./config.js";
import type { Employee } from "./employee.js";
import { generateCardSvgString } from "./svg-core.js";

export async function generateCardSvg(
  employee: Employee,
  vcard: string,
  outputPath: string,
): Promise<void> {
  const [regular, bold, extraBold] = await Promise.all([
    readFile(PATHS.regularFont),
    readFile(PATHS.boldFont),
    readFile(PATHS.extraBoldFont),
  ]);
  const svg = generateCardSvgString(employee, vcard, {
    regular: regular.toString("base64"),
    bold: bold.toString("base64"),
    extraBold: extraBold.toString("base64"),
  });
  await writeFile(outputPath, svg);
}
