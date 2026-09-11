import path from "node:path";
import { ASSET_HASHES } from "./design.js";
export { ASSET_HASHES, COMPANY, DESIGN, PAGE } from "./design.js";

export const PROJECT_ROOT = path.resolve(process.env.EQUINOX_PROJECT_ROOT ?? process.cwd());

export const PATHS = {
  staticTemplatePdf: path.join(PROJECT_ROOT, "template", "static-template.pdf"),
  regularFont: path.join(PROJECT_ROOT, "template", "fonts", "Manrope-Regular.ttf"),
  boldFont: path.join(PROJECT_ROOT, "template", "fonts", "Manrope-Bold.ttf"),
  extraBoldFont: path.join(PROJECT_ROOT, "template", "fonts", "Manrope-ExtraBold.ttf"),
  outputDirectory: path.join(PROJECT_ROOT, "output"),
} as const;

export const SOURCE_HASHES = {
  staticTemplatePdf: ASSET_HASHES.staticTemplate,
} as const;

export const VALIDATION = {
  dpi: 600,
  dimensionTolerancePoints: 0.02,
} as const;
