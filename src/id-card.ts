import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

const cleanText = z.string().transform((value) => value.trim().normalize("NFC")).pipe(z.string().min(1).max(120));
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const idCardInputSchema = z.object({
  firstName: cleanText,
  lastName: cleanText,
  jobTitle: cleanText,
  employeeId: cleanText.pipe(z.string().max(30)),
  mobile: cleanText,
  bloodGroup: z.enum(bloodGroups),
  emergencyContact: cleanText,
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Date of birth is required"),
}).strict();

export type IdCardInput = z.input<typeof idCardInputSchema>;

export interface IdCardEmployee extends Omit<z.output<typeof idCardInputSchema>, "mobile" | "emergencyContact"> {
  fullName: string;
  displayMobile: string;
  displayEmergencyContact: string;
  displayDateOfBirth: string;
  fileStem: string;
}

function formatPhone(value: string): string {
  const phone = parsePhoneNumberFromString(value, "IN");
  if (!phone?.isValid()) throw new Error(`Invalid phone number: ${value}`);
  const digits = phone.nationalNumber;
  return phone.country === "IN" && digits.length === 10
    ? `+91-${digits.slice(0, 5)}-${digits.slice(5)}`
    : phone.formatInternational();
}

function safeFilenamePart(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").replace(/[^A-Za-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Date of birth is not a valid calendar date");
  }
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(date)
    .replace(/ /gu, "-");
}

export function normalizeIdCardEmployee(input: IdCardInput): IdCardEmployee {
  const parsed = idCardInputSchema.parse(input);
  const first = safeFilenamePart(parsed.firstName);
  const last = safeFilenamePart(parsed.lastName);
  if (!first || !last) throw new Error("First and last names must contain filename-safe letters or numbers");
  return {
    ...parsed,
    fullName: `${parsed.firstName} ${parsed.lastName}`,
    displayMobile: formatPhone(parsed.mobile),
    displayEmergencyContact: formatPhone(parsed.emergencyContact),
    displayDateOfBirth: formatDate(parsed.dateOfBirth),
    fileStem: `${first}-${last}`,
  };
}

