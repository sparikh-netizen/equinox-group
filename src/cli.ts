#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { PATHS } from "./config.js";
import { generateCard, loadEmployeeInput } from "./generator.js";

const program = new Command()
  .name("equinox-card")
  .description("Generate a validated Equinox employee visiting card")
  .requiredOption("-i, --input <path>", "employee JSON file")
  .option("-o, --output <directory>", "output directory", PATHS.outputDirectory)
  .option("--verbose", "show detailed validation metrics", false);

program.parse();
const options = program.opts<{ input: string; output: string; verbose: boolean }>();

async function main(): Promise<void> {
  console.log("Equinox Business Card Generator\n");
  const inputPath = path.resolve(options.input);
  const employeeInput = await loadEmployeeInput(inputPath);
  const result = await generateCard(employeeInput, path.resolve(options.output));
  const employee = result.report.employee;
  console.log(`${employee.fullName}\n${employee.jobTitle}\n`);
  console.log("✓ Employee data validated");
  console.log("✓ vCard generated");
  console.log("✓ QR generated and payload verified");
  console.log("✓ Print PDF generated with embedded Manrope fonts");
  console.log("✓ PDF dimensions and employee text verified");
  console.log("✓ Static artwork comparison passed");
  if (options.verbose) {
    console.log(`  QR modules: ${result.report.qr.modules}`);
    console.log(`  Static pixels compared: ${result.report.staticPixelComparison.comparedPixels}`);
    console.log(`  Unexpected static differences: ${result.report.staticPixelComparison.unexpectedDifferentPixels}`);
  }
  console.log(`\nOutput:\n${result.outputDirectory}\n\nPASS`);
}

main().catch((error: unknown) => {
  console.error(`\nFAIL\n${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
