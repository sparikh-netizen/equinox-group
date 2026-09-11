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
    x: 192,
    y: 23,
    size: 54,
    marginModules: 4,
    errorCorrectionLevel: "L" as const,
    minimumPrintDotsAt300Dpi: 4,
  },
  validationMasks: [
    { name: "employee-details", x: 24, y: 91, width: 140, height: 50 },
    { name: "employee-qr", x: 192, y: 23, width: 54, height: 54 },
  ],
} as const;

export const ASSET_HASHES = {
  staticTemplate: "f37ea26e5c650c09652c78b2c73d1ff6d18f8650abb1027e5b2104b0eb7ec5de",
  regularFont: "2960175e094cf559435dd6ad7b67391689a95e866e7989b70560937dccaaea87",
  boldFont: "ce687c0c867a4d43dc683d19c6e065bb84c027d3c9e4dd51e82fb53908d4f849",
  extraBoldFont: "effbf6efd56d3bc969fcfa43097932e1a858b6cd0ff6564425e0cc48554ad463",
} as const;
