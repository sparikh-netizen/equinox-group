import { describe, expect, it } from "vitest";
import { normalizeEmployee } from "../src/employee.js";
import { escapeVCardValue, generateVCard } from "../src/vcard.js";

describe("vCard", () => {
  it("escapes reserved vCard characters", () => {
    expect(escapeVCardValue("A, B; C\\D\nE")).toBe("A\\, B\\; C\\\\D\\nE");
  });

  it("contains the same canonical employee and company data as the card", () => {
    const card = generateVCard(
      normalizeEmployee({
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Director",
        email: "john.smith@equinoxgroup.in",
        mobile: "+91-90000-00000",
      }),
    );

    expect(card).toContain("VERSION:3.0\r\n");
    expect(card).toContain("FN:John Smith\r\n");
    expect(card).toContain("ORG:Equinox Solutions Pvt. Ltd.\r\n");
    expect(card).toContain("TEL;TYPE=CELL:+919000000000\r\n");
    expect(card).toContain("EMAIL;TYPE=WORK:john.smith@equinoxgroup.in\r\n");
    expect(card).toContain("URL:https://www.equinoxgroup.in\r\n");
    expect(card.endsWith("END:VCARD\r\n")).toBe(true);
    expect(card.replaceAll("\r\n", "")).not.toContain("\n");
  });
});
