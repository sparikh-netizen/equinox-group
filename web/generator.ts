import JSZip from "jszip";
import { ASSET_HASHES, PAGE } from "../src/design.js";
import { normalizeEmployee, type Employee, type EmployeeInput } from "../src/employee.js";
import { normalizeIdCardEmployee, type IdCardEmployee, type IdCardInput } from "../src/id-card.js";
import { ID_ASSET_HASHES, ID_PAGE } from "../src/id-design.js";
import { generateIdPdfBytes } from "../src/id-pdf-core.js";
import { generatePrintPdfBytes, type PdfAssets } from "../src/pdf-core.js";
import { generateQrSvg } from "../src/qr-core.js";
import { generateCardSvgString } from "../src/svg-core.js";
import { generateVCard } from "../src/vcard.js";

interface LoadedAssets extends PdfAssets {
  boldFont: Uint8Array;
  idStaticTemplate: Uint8Array;
  idTopLogoOverlay: Uint8Array;
}

export interface BrowserArtifacts {
  employee: Employee;
  files: {
    pdf: { name: string; blob: Blob };
    vcf: { name: string; blob: Blob };
    qr: { name: string; blob: Blob };
    cardSvg: { name: string; blob: Blob };
    report: { name: string; blob: Blob };
    zip: { name: string; blob: Blob };
  };
}

export interface BrowserIdArtifacts {
  employee: IdCardEmployee;
  files: {
    pdf: { name: string; blob: Blob };
    photo: { name: string; blob: Blob };
    report: { name: string; blob: Blob };
    zip: { name: string; blob: Blob };
  };
}

const assetPaths = {
  staticTemplate: "assets/static-template.pdf",
  regularFont: "assets/fonts/Manrope-Regular.ttf",
  boldFont: "assets/fonts/Manrope-Bold.ttf",
  extraBoldFont: "assets/fonts/Manrope-ExtraBold.ttf",
  idStaticTemplate: "assets/id-static-template.pdf",
  idTopLogoOverlay: "assets/id-top-logo-overlay.pdf",
} as const;

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchAsset(assetPath: string, expectedHash: string): Promise<Uint8Array> {
  const response = await fetch(`${import.meta.env.BASE_URL}${assetPath}`);
  if (!response.ok) throw new Error(`Could not load a required production asset (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if ((await sha256(bytes)) !== expectedHash) throw new Error("A production asset failed its integrity check");
  return bytes;
}

let assetsPromise: Promise<LoadedAssets> | undefined;

export function loadProductionAssets(): Promise<LoadedAssets> {
  assetsPromise ??= Promise.all([
    fetchAsset(assetPaths.staticTemplate, ASSET_HASHES.staticTemplate),
    fetchAsset(assetPaths.regularFont, ASSET_HASHES.regularFont),
    fetchAsset(assetPaths.boldFont, ASSET_HASHES.boldFont),
    fetchAsset(assetPaths.extraBoldFont, ASSET_HASHES.extraBoldFont),
    fetchAsset(assetPaths.idStaticTemplate, ID_ASSET_HASHES.staticTemplate),
    fetchAsset(assetPaths.idTopLogoOverlay, ID_ASSET_HASHES.topLogoOverlay),
  ]).then(([staticTemplate, regularFont, boldFont, extraBoldFont, idStaticTemplate, idTopLogoOverlay]) => ({
    staticTemplate,
    regularFont,
    boldFont,
    extraBoldFont,
    idStaticTemplate,
    idTopLogoOverlay,
  }));
  return assetsPromise;
}

function canvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => canvas.toBlob(async (blob) => {
    if (!blob) return reject(new Error("Could not process the employee photo"));
    resolve(new Uint8Array(await blob.arrayBuffer()));
  }, "image/jpeg", 0.94));
}

export async function processIdPhoto(file: File): Promise<Uint8Array> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPEG, PNG, or WebP employee photo");
  if (file.size > 15 * 1024 * 1024) throw new Error("Employee photo must be smaller than 15 MB");
  const sourceUrl = URL.createObjectURL(file);
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected employee photo could not be opened"));
    image.src = sourceUrl;
  }).finally(() => URL.revokeObjectURL(sourceUrl));
  const width = 850;
  const height = Math.round(width * (115.77 / 102.048));
  const targetRatio = width / height;
  const sourceRatio = source.naturalWidth / source.naturalHeight;
  const sourceWidth = sourceRatio > targetRatio ? source.naturalHeight * targetRatio : source.naturalWidth;
  const sourceHeight = sourceRatio > targetRatio ? source.naturalHeight : source.naturalWidth / targetRatio;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot process the employee photo");
  context.drawImage(source, (source.naturalWidth - sourceWidth) / 2, (source.naturalHeight - sourceHeight) / 2, sourceWidth, sourceHeight, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = Math.round(pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114);
    pixels.data[index] = gray;
    pixels.data[index + 1] = gray;
    pixels.data[index + 2] = gray;
  }
  context.putImageData(pixels, 0, 0);
  return canvasJpeg(canvas);
}

export async function generateBrowserIdArtifacts(input: IdCardInput, photoFile: File): Promise<BrowserIdArtifacts> {
  const employee = normalizeIdCardEmployee(input);
  const [assets, photoJpeg] = await Promise.all([loadProductionAssets(), processIdPhoto(photoFile)]);
  const result = await generateIdPdfBytes(employee, {
    staticTemplate: assets.idStaticTemplate,
    topLogoOverlay: assets.idTopLogoOverlay,
    regularFont: assets.regularFont,
    extraBoldFont: assets.extraBoldFont,
    photoJpeg,
  });
  const names = {
    pdf: `${employee.fileStem}-ID-PRINT.pdf`,
    photo: `${employee.fileStem}-ID-Photo.jpg`,
    report: "validation-report.json",
  };
  const pdfBlob = new Blob([new Uint8Array(result.bytes)], { type: "application/pdf" });
  const photoBlob = new Blob([photoJpeg.buffer as ArrayBuffer], { type: "image/jpeg" });
  const report = {
    passed: true,
    generatedAt: new Date().toISOString(),
    environment: "browser",
    privacy: "Generated locally; employee data and photo were not transmitted or stored",
    employee: { fullName: employee.fullName, employeeId: employee.employeeId },
    document: { passed: true, sizeMm: { width: ID_PAGE.widthMm, height: ID_PAGE.heightMm }, sides: 1 },
    photo: { passed: true, grayscale: true, centerCropped: true },
    textFit: { passed: true, fields: result.textFit },
    assetIntegrity: { passed: true },
  };
  const reportBlob = textBlob(`${JSON.stringify(report, null, 2)}\n`, "application/json");
  const zip = new JSZip();
  zip.file(names.pdf, pdfBlob);
  zip.file(names.photo, photoBlob);
  zip.file(names.report, reportBlob);
  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return {
    employee,
    files: {
      pdf: { name: names.pdf, blob: pdfBlob },
      photo: { name: names.photo, blob: photoBlob },
      report: { name: names.report, blob: reportBlob },
      zip: { name: `${employee.fileStem}-ID-Package.zip`, blob: zipBlob },
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function textBlob(value: string, type: string): Blob {
  return new Blob([value], { type });
}

export async function generateBrowserArtifacts(input: EmployeeInput): Promise<BrowserArtifacts> {
  const employee = normalizeEmployee(input);
  const assets = await loadProductionAssets();
  const vcard = generateVCard(employee);
  const qrSvg = generateQrSvg(vcard);
  const pdf = await generatePrintPdfBytes(employee, vcard, assets);
  const cardSvg = generateCardSvgString(employee, vcard, {
    regular: bytesToBase64(assets.regularFont),
    bold: bytesToBase64(assets.boldFont),
    extraBold: bytesToBase64(assets.extraBoldFont),
  });

  const names = {
    pdf: `${employee.fileStem}-VisitingCard-PRINT.pdf`,
    vcf: `${employee.fileStem}.vcf`,
    qr: `${employee.fileStem}-QR.svg`,
    cardSvg: `${employee.fileStem}-VisitingCard.svg`,
    report: "validation-report.json",
  };
  const blobs = {
    pdf: new Blob([new Uint8Array(pdf.bytes)], { type: "application/pdf" }),
    vcf: textBlob(vcard, "text/vcard;charset=utf-8"),
    qr: textBlob(qrSvg, "image/svg+xml;charset=utf-8"),
    cardSvg: textBlob(cardSvg, "image/svg+xml;charset=utf-8"),
  };
  const report = {
    passed: true,
    generatedAt: new Date().toISOString(),
    environment: "browser",
    privacy: "Generated locally; employee data was not transmitted or stored",
    employee: {
      fullName: employee.fullName,
      jobTitle: employee.jobTitle,
      email: employee.email,
      mobile: employee.displayMobile,
    },
    document: {
      passed: true,
      pageSizePoints: { width: PAGE.width, height: PAGE.height },
      trimBoxPoints: PAGE.trimBox,
    },
    textFit: { passed: true, fields: pdf.result.textFit },
    qr: {
      passed: true,
      modules: pdf.result.qrModules,
      moduleSizeMm: pdf.result.qrModuleSizeMm,
      dotsAt300Dpi: pdf.result.qrDotsAt300Dpi,
      source: "compact contact vCard",
    },
    assetIntegrity: { passed: true },
  };
  const reportBlob = textBlob(`${JSON.stringify(report, null, 2)}\n`, "application/json");
  const zip = new JSZip();
  zip.file(names.pdf, blobs.pdf);
  zip.file(names.vcf, blobs.vcf);
  zip.file(names.qr, blobs.qr);
  zip.file(names.cardSvg, blobs.cardSvg);
  zip.file(names.report, reportBlob);
  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

  return {
    employee,
    files: {
      pdf: { name: names.pdf, blob: blobs.pdf },
      vcf: { name: names.vcf, blob: blobs.vcf },
      qr: { name: names.qr, blob: blobs.qr },
      cardSvg: { name: names.cardSvg, blob: blobs.cardSvg },
      report: { name: names.report, blob: reportBlob },
      zip: { name: `${employee.fileStem}-VisitingCard-Package.zip`, blob: zipBlob },
    },
  };
}
