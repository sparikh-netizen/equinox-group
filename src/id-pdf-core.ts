import fontkit from "@pdf-lib/fontkit";
import { cmyk, PDFDocument, PDFName, type PDFFont } from "pdf-lib";
import { ID_DESIGN, ID_PAGE } from "./id-design.js";
import type { IdCardEmployee } from "./id-card.js";

export interface IdPdfAssets {
  staticTemplate: Uint8Array;
  topLogoOverlay: Uint8Array;
  regularFont: Uint8Array;
  extraBoldFont: Uint8Array;
  photoJpeg: Uint8Array;
}

export interface IdTextFitResult { field: string; value: string; width: number; maximumWidth: number; passed: boolean }

export async function generateIdPdfBytes(employee: IdCardEmployee, assets: IdPdfAssets) {
  const pdf = await PDFDocument.load(assets.staticTemplate);
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(assets.regularFont, { subset: true });
  const extraBold = await pdf.embedFont(assets.extraBoldFont, { subset: true });
  const photo = await pdf.embedJpg(assets.photoJpeg);
  const overlaySource = await PDFDocument.load(assets.topLogoOverlay);
  const [topLogo] = await pdf.embedPdf(overlaySource, [0]);
  const page = pdf.getPage(0);
  if (Math.abs(page.getWidth() - ID_PAGE.width) > 0.02 || Math.abs(page.getHeight() - ID_PAGE.height) > 0.02) {
    throw new Error("ID template dimensions do not match the approved 54 × 85 mm reference");
  }

  const detailLines = [
    `Employee ID: ${employee.employeeId}`,
    `Phone:${employee.displayMobile}`,
    `Blood Group: ${employee.bloodGroup}`,
    `Emergency Contact: ${employee.displayEmergencyContact}`,
    `DOB: ${employee.displayDateOfBirth}`,
  ];
  const fields: Array<{ field: string; value: string; font: PDFFont; size: number; maximumWidth: number }> = [
    { field: "name", value: employee.fullName, font: extraBold, ...ID_DESIGN.name },
    { field: "title", value: employee.jobTitle, font: regular, ...ID_DESIGN.title },
    ...detailLines.map((value, index) => ({ field: `detail-${index + 1}`, value, font: regular, size: ID_DESIGN.details.size, maximumWidth: ID_DESIGN.details.maximumWidth })),
  ];
  const textFit: IdTextFitResult[] = fields.map(({ field, value, font, size, maximumWidth }) => {
    const width = font.widthOfTextAtSize(value, size);
    return { field, value, width, maximumWidth, passed: width <= maximumWidth };
  });
  const failed = textFit.find(({ passed }) => !passed);
  if (failed) throw new Error(`ID ${failed.field} is too long for the approved template: "${failed.value}"`);

  page.drawImage(photo, ID_DESIGN.photo);
  page.drawPage(topLogo, { x: 0, y: 0, width: ID_PAGE.width, height: ID_PAGE.height });
  const color = cmyk(ID_DESIGN.color.cyan, ID_DESIGN.color.magenta, ID_DESIGN.color.yellow, ID_DESIGN.color.key);
  page.drawText(employee.fullName, { ...ID_DESIGN.name, font: extraBold, color });
  page.drawText(employee.jobTitle, { ...ID_DESIGN.title, font: regular, color });
  detailLines.forEach((line, index) => page.drawText(line, {
    x: ID_DESIGN.details.x,
    y: ID_DESIGN.details.y - index * ID_DESIGN.details.leading,
    size: ID_DESIGN.details.size,
    font: regular,
    color,
  }));

  pdf.setTitle(`${employee.fullName} ID Card`);
  pdf.setAuthor("Equinox Solutions Pvt. Ltd.");
  pdf.setSubject("Print-ready employee ID card");
  pdf.setCreator("Equinox ID Card Generator");
  pdf.setProducer("pdf-lib");
  pdf.setCreationDate(new Date("2026-01-01T00:00:00.000Z"));
  pdf.setModificationDate(new Date("2026-01-01T00:00:00.000Z"));
  pdf.catalog.delete(PDFName.of("Metadata"));
  return { bytes: await pdf.save({ useObjectStreams: false }), textFit };
}
