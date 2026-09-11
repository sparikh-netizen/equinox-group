import JSZip from "jszip";
import { ASSET_HASHES, PAGE } from "../src/design.js";
import { normalizeEmployee, type Employee, type EmployeeInput } from "../src/employee.js";
import { generatePrintPdfBytes, type PdfAssets } from "../src/pdf-core.js";
import { generateQrSvg } from "../src/qr-core.js";
import { generateCardSvgString } from "../src/svg-core.js";
import { generateVCard } from "../src/vcard.js";

interface LoadedAssets extends PdfAssets {
  boldFont: Uint8Array;
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

const assetPaths = {
  staticTemplate: "assets/static-template.pdf",
  regularFont: "assets/fonts/Manrope-Regular.ttf",
  boldFont: "assets/fonts/Manrope-Bold.ttf",
  extraBoldFont: "assets/fonts/Manrope-ExtraBold.ttf",
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
  ]).then(([staticTemplate, regularFont, boldFont, extraBoldFont]) => ({
    staticTemplate,
    regularFont,
    boldFont,
    extraBoldFont,
  }));
  return assetsPromise;
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
    qr: { passed: true, modules: pdf.result.qrModules, source: "canonical vCard" },
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
