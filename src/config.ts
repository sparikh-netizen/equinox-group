import path from "node:path";

export const PROJECT_ROOT = path.resolve(process.env.EQUINOX_PROJECT_ROOT ?? process.cwd());

export const PATHS = {
  staticTemplatePdf: path.join(PROJECT_ROOT, "template", "static-template.pdf"),
  regularFont: path.join(PROJECT_ROOT, "template", "fonts", "Manrope-Regular.ttf"),
  boldFont: path.join(PROJECT_ROOT, "template", "fonts", "Manrope-Bold.ttf"),
  extraBoldFont: path.join(PROJECT_ROOT, "template", "fonts", "Manrope-ExtraBold.ttf"),
  outputDirectory: path.join(PROJECT_ROOT, "output"),
} as const;

export const SOURCE_HASHES = {
  staticTemplatePdf: "f37ea26e5c650c09652c78b2c73d1ff6d18f8650abb1027e5b2104b0eb7ec5de",
} as const;

export const COMPANY = {
  name: "Equinox Solutions Pvt. Ltd.",
  website: "https://www.equinoxgroup.in",
  officePhone: "+917969208000",
  address: {
    street: "101-103, North Tower, ONE42, B/h Ashok Vatika, Ambli Bopal Road, Bodakdev",
    locality: "Ahmedabad",
    region: "",
    postalCode: "380054",
    country: "India",
  },
} as const;

export const PAGE = {
  width: 269.008,
  height: 161.008,
  trimBox: { x: 8.50394, y: 8.50394, width: 252, height: 144 },
  bleedMm: 3,
} as const;

export const DESIGN = {
  fontSize: 6.5,
  color: { cyan: 0.755, magenta: 0.659, yellow: 0.604, key: 0.814 },
  secondaryColor: { cyan: 0.912, magenta: 0.787, yellow: 0.62, key: 0.974 },
  employee: {
    x: 28.0796,
    nameY: 128.2659,
    titleY: 120.4659,
    emailY: 104.8659,
    mobileY: 97.0659,
    maximumWidth: 126,
  },
  qr: {
    x: 195.4495697,
    y: 26.2469234,
    size: 47.3527546,
    marginModules: 4,
    errorCorrectionLevel: "M" as const,
  },
  validationMasks: [
    { name: "employee-details", x: 24, y: 91, width: 140, height: 50 },
    { name: "employee-qr", x: 192, y: 23, width: 54, height: 54 },
  ],
} as const;

export const VALIDATION = {
  dpi: 600,
  dimensionTolerancePoints: 0.02,
} as const;
