import { COMPANY } from "./config.js";
import type { Employee } from "./employee.js";

export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/\r\n|\r|\n/gu, "\\n")
    .replace(/;/gu, "\\;")
    .replace(/,/gu, "\\,");
}

export function generateVCard(employee: Employee): string {
  const address = COMPANY.address;
  const addressValue = [
    "",
    "",
    escapeVCardValue(address.street),
    escapeVCardValue(address.locality),
    escapeVCardValue(address.region),
    escapeVCardValue(address.postalCode),
    escapeVCardValue(address.country),
  ].join(";");

  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCardValue(employee.lastName)};${escapeVCardValue(employee.firstName)};;;`,
    `FN:${escapeVCardValue(employee.fullName)}`,
    `ORG:${escapeVCardValue(COMPANY.name)}`,
    `TITLE:${escapeVCardValue(employee.jobTitle)}`,
    `TEL;TYPE=CELL:${employee.normalizedPhone}`,
    `TEL;TYPE=WORK:${COMPANY.officePhone}`,
    `EMAIL;TYPE=WORK:${escapeVCardValue(employee.email)}`,
    `ADR;TYPE=WORK:${addressValue}`,
    `URL:${COMPANY.website}`,
    "END:VCARD",
    "",
  ].join("\r\n");
}
