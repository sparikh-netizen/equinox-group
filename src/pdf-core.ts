import fontkit from "@pdf-lib/fontkit";
import { cmyk, PDFDocument, PDFName } from "pdf-lib";
import { DESIGN, PAGE } from "./design.js";
import type { Employee } from "./employee.js";
import { createQrMatrix } from "./qr-core.js";

export interface TextFitResult {
  field: "name" | "title" | "email" | "mobile";
  value: string;
  width: number;
  maximumWidth: number;
  passed: boolean;
}

export interface PdfGenerationResult {
  textFit: TextFitResult[];
  qrModules: number;
}

export interface PdfAssets {
  staticTemplate: Uint8Array;
  regularFont: Uint8Array;
  extraBoldFont: Uint8Array;
}

export async function generatePrintPdfBytes(
  employee: Employee,
  vcard: string,
  assets: PdfAssets,
): Promise<{ bytes: Uint8Array; result: PdfGenerationResult }> {
  const pdf = await PDFDocument.load(assets.staticTemplate);
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(assets.regularFont, { subset: true });
  const extraBold = await pdf.embedFont(assets.extraBoldFont, { subset: true });
  const page = pdf.getPage(0);
  if (Math.abs(page.getWidth() - PAGE.width) > 0.02 || Math.abs(page.getHeight() - PAGE.height) > 0.02) {
    throw new Error("Static template page dimensions do not match the approved reference");
  }

  const fields = [
    { field: "name" as const, value: employee.fullName, font: extraBold, y: DESIGN.employee.nameY },
    { field: "title" as const, value: employee.jobTitle, font: regular, y: DESIGN.employee.titleY },
    { field: "email" as const, value: employee.email, font: regular, y: DESIGN.employee.emailY },
    { field: "mobile" as const, value: employee.displayMobile, font: regular, y: DESIGN.employee.mobileY },
  ];

  const textFit = fields.map(({ field, value, font }) => {
    const width = font.widthOfTextAtSize(value, DESIGN.fontSize);
    return { field, value, width, maximumWidth: DESIGN.employee.maximumWidth, passed: width <= DESIGN.employee.maximumWidth };
  });
  const failed = textFit.find((result) => !result.passed);
  if (failed) {
    throw new Error(
      `Employee ${failed.field} is too long for the approved template: "${failed.value}". ` +
        `Current width: ${failed.width.toFixed(2)} pt. Maximum: ${failed.maximumWidth.toFixed(2)} pt.`,
    );
  }

  const primary = cmyk(DESIGN.color.cyan, DESIGN.color.magenta, DESIGN.color.yellow, DESIGN.color.key);
  for (const field of fields) {
    page.drawText(field.value, {
      x: DESIGN.employee.x,
      y: field.y,
      size: DESIGN.fontSize,
      font: field.font,
      color: primary,
    });
  }

  const matrix = createQrMatrix(vcard);
  const margin = DESIGN.qr.marginModules;
  const totalModules = matrix.modules + margin * 2;
  const moduleSize = DESIGN.qr.size / totalModules;
  page.drawRectangle({
    x: DESIGN.qr.x,
    y: DESIGN.qr.y,
    width: DESIGN.qr.size,
    height: DESIGN.qr.size,
    color: cmyk(0, 0, 0, 0),
  });
  for (let row = 0; row < matrix.modules; row += 1) {
    let column = 0;
    while (column < matrix.modules) {
      while (column < matrix.modules && !matrix.data[row * matrix.modules + column]) column += 1;
      if (column >= matrix.modules) break;
      const start = column;
      while (column < matrix.modules && matrix.data[row * matrix.modules + column]) column += 1;
      page.drawRectangle({
        x: DESIGN.qr.x + (start + margin) * moduleSize,
        y: DESIGN.qr.y + DESIGN.qr.size - (row + margin + 1) * moduleSize,
        width: (column - start) * moduleSize,
        height: moduleSize,
        color: cmyk(0, 0, 0, 1),
      });
    }
  }

  pdf.setTitle(`${employee.fullName} Visiting Card`);
  pdf.setAuthor("Equinox Solutions Pvt. Ltd.");
  pdf.setSubject("Print-ready employee visiting card");
  pdf.setCreator("Equinox Business Card Generator");
  pdf.setProducer("pdf-lib");
  pdf.setCreationDate(new Date("2026-01-01T00:00:00.000Z"));
  pdf.setModificationDate(new Date("2026-01-01T00:00:00.000Z"));
  pdf.catalog.delete(PDFName.of("Metadata"));

  return {
    bytes: await pdf.save({ useObjectStreams: false }),
    result: { textFit, qrModules: matrix.modules },
  };
}
