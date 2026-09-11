import { DESIGN, PAGE } from "./design.js";
import type { Employee } from "./employee.js";
import { qrPathForSvg } from "./qr-core.js";

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

function rgbFromCmyk(c: number, m: number, y: number, k: number): string {
  const channel = (ink: number) => Math.round(255 * (1 - Math.min(1, ink * (1 - k) + k)));
  return `rgb(${channel(c)},${channel(m)},${channel(y)})`;
}

export function generateCardSvgString(
  employee: Employee,
  vcard: string,
  fonts: { regular: string; bold: string; extraBold: string },
): string {
  const qr = qrPathForSvg(vcard);
  const qrScale = DESIGN.qr.size / qr.totalModules;
  const primary = rgbFromCmyk(DESIGN.color.cyan, DESIGN.color.magenta, DESIGN.color.yellow, DESIGN.color.key);
  const secondary = rgbFromCmyk(
    DESIGN.secondaryColor.cyan,
    DESIGN.secondaryColor.magenta,
    DESIGN.secondaryColor.yellow,
    DESIGN.secondaryColor.key,
  );
  const topY = (pdfY: number) => PAGE.height - pdfY;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="94.9mm" height="56.8mm" viewBox="0 0 ${PAGE.width} ${PAGE.height}">
  <metadata>Equinox visiting card; trim 88.9 x 50.8 mm; 3 mm bleed.</metadata>
  <style>
    @font-face { font-family: Manrope; font-style: normal; font-weight: 400; src: url(data:font/ttf;base64,${fonts.regular}); }
    @font-face { font-family: Manrope; font-style: normal; font-weight: 700; src: url(data:font/ttf;base64,${fonts.bold}); }
    @font-face { font-family: Manrope; font-style: normal; font-weight: 800; src: url(data:font/ttf;base64,${fonts.extraBold}); }
    text { font-family: Manrope, sans-serif; font-size: ${DESIGN.fontSize}px; fill: ${primary}; }
    text.secondary { fill: ${secondary}; }
  </style>
  <rect width="${PAGE.width}" height="${PAGE.height}" fill="#fff"/>
  <text x="27.5117" y="${topY(59.3662)}">101-103, North Tower, ONE42,</text>
  <text x="27.5117" y="${topY(51.5662)}">B/h Ashok Vatika,</text>
  <text x="27.5117" y="${topY(43.7662)}">Ambli Bopal Road, Bodakdev,</text>
  <text x="27.5117" y="${topY(35.9662)}">Ahmedabad, 380054, India</text>
  <text x="27.5117" y="${topY(28.1662)}">+91-79-6920-8000</text>
  <text x="240.7117" y="${topY(128.0754)}" text-anchor="end"><tspan font-weight="700">EQUINOX SOLUTIONS </tspan><tspan font-weight="400">PVT. LTD.</tspan></text>
  <text class="secondary" x="240.7271" y="${topY(120.4854)}" text-anchor="end">www.equinoxgroup.in</text>
  <text x="${DESIGN.employee.x}" y="${topY(DESIGN.employee.nameY)}" font-weight="800">${escapeXml(employee.fullName)}</text>
  <text x="${DESIGN.employee.x}" y="${topY(DESIGN.employee.titleY)}">${escapeXml(employee.jobTitle)}</text>
  <text x="${DESIGN.employee.x}" y="${topY(DESIGN.employee.emailY)}">${escapeXml(employee.email)}</text>
  <text x="${DESIGN.employee.x}" y="${topY(DESIGN.employee.mobileY)}">${escapeXml(employee.displayMobile)}</text>
  <g transform="translate(${DESIGN.qr.x} ${topY(DESIGN.qr.y + DESIGN.qr.size)}) scale(${qrScale})" shape-rendering="crispEdges">
    <rect width="${qr.totalModules}" height="${qr.totalModules}" fill="#fff"/>
    <path fill="#000" d="${qr.path}"/>
  </g>
</svg>
`;
}
