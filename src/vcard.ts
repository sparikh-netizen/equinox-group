import type { Employee } from "./employee.js";

export function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/gu, "\\\\")
    .replace(/\r\n|\r|\n/gu, "\\n")
    .replace(/;/gu, "\\;")
    .replace(/,/gu, "\\,");
}

export function generateVCard(employee: Employee): string {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCardValue(employee.lastName)};${escapeVCardValue(employee.firstName)};;;`,
    `FN:${escapeVCardValue(employee.fullName)}`,
    `TITLE:${escapeVCardValue(employee.jobTitle)}`,
    `TEL:${employee.normalizedPhone}`,
    `EMAIL:${escapeVCardValue(employee.email)}`,
    "END:VCARD",
    "",
  ].join("\r\n");
}
