import type { Employee } from "./employee.js";
import { COMPANY } from "./design.js";

export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/\r\n|\r|\n/gu, "\\n")
    .replace(/;/gu, "\\;")
    .replace(/,/gu, "\\,");
}

export function generateVCard(employee: Employee): string {
  const address = [
    "",
    "",
    escapeVCardValue(COMPANY.address.street),
    escapeVCardValue(COMPANY.address.locality),
    escapeVCardValue(COMPANY.address.region),
    escapeVCardValue(COMPANY.address.postalCode),
    escapeVCardValue(COMPANY.address.country),
  ].join(";");
  return [
    "BEGIN:VCARD",
    "VERSION:2.1",
    `N:${escapeVCardValue(employee.lastName)};${escapeVCardValue(employee.firstName)};;;`,
    `EMAIL;INTERNET:${escapeVCardValue(employee.email)}`,
    `TEL;CELL:${employee.normalizedPhone}`,
    `TEL;WORK:${COMPANY.officePhone}`,
    `ADR;WORK:${address}`,
    "ORG:Equinox Solutions",
    "URL:https://equinoxgroup.in/",
    `NOTE:${escapeVCardValue(employee.jobTitle)}`,
    "END:VCARD",
    "",
  ].join("\n");
}
