import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

const noControlCharacters = (value: string) => !/[\u0000-\u001f\u007f]/u.test(value);

const cleanRequiredText = z
  .string()
  .transform((value) => value.trim().normalize("NFC"))
  .pipe(z.string().min(1).max(120).refine(noControlCharacters, "Control characters are not allowed"));

export const employeeInputSchema = z
  .object({
    firstName: cleanRequiredText,
    lastName: cleanRequiredText,
    jobTitle: cleanRequiredText,
    email: z
      .string()
      .transform((value) => value.trim().normalize("NFC").toLowerCase())
      .pipe(z.email().max(254).refine(noControlCharacters, "Control characters are not allowed")),
    mobile: cleanRequiredText,
  })
  .strict();

export type EmployeeInput = z.input<typeof employeeInputSchema>;

export interface Employee {
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle: string;
  email: string;
  displayMobile: string;
  normalizedPhone: string;
  fileSlug: string;
  fileStem: string;
}

function safeFilenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^A-Za-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export function normalizeEmployee(input: EmployeeInput): Employee {
  const parsed = employeeInputSchema.parse(input);
  const phone = parsePhoneNumberFromString(parsed.mobile, "IN");
  if (!phone?.isValid()) {
    throw new Error(`Invalid mobile number: ${parsed.mobile}`);
  }

  const nationalDigits = phone.nationalNumber;
  const displayMobile =
    phone.country === "IN" && nationalDigits.length === 10
      ? `+91-${nationalDigits.slice(0, 5)}-${nationalDigits.slice(5)}`
      : phone.formatInternational();

  const firstPart = safeFilenamePart(parsed.firstName);
  const lastPart = safeFilenamePart(parsed.lastName);
  if (!firstPart || !lastPart) {
    throw new Error("First and last names must contain filename-safe letters or numbers");
  }

  const fileStem = `${firstPart}-${lastPart}`;
  return {
    ...parsed,
    fullName: `${parsed.firstName} ${parsed.lastName}`,
    displayMobile,
    normalizedPhone: phone.number,
    fileSlug: fileStem.toLowerCase(),
    fileStem,
  };
}
