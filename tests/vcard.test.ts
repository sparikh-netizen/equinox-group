import { describe, expect, it } from "vitest";
import { normalizeEmployee } from "../src/employee.js";
import { escapeVCardValue, generateVCard } from "../src/vcard.js";

describe("vCard", () => {
  it("escapes reserved vCard characters", () => {
    expect(escapeVCardValue("A, B; C\\D\nE")).toBe("A\\, B\\; C\\\\D\\nE");
  });

  it("matches the complete contact structure from the approved master", () => {
    const card = generateVCard(
      normalizeEmployee({
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Director",
        email: "john.smith@equinoxgroup.in",
        mobile: "+91-90000-00000",
      }),
    );

    expect(card).toContain("VERSION:2.1\n");
    expect(card).toContain("N:Smith;John;;;\n");
    expect(card).toContain("EMAIL;INTERNET:john.smith@equinoxgroup.in\n");
    expect(card).toContain("TEL;CELL:+919000000000\n");
    expect(card).toContain("TEL;WORK:+917969208000\n");
    expect(card).toContain("ADR;WORK:;;101-103\\, North Tower\\, ONE42");
    expect(card).toContain("ORG:Equinox Solutions\n");
    expect(card).toContain("URL:https://equinoxgroup.in/\n");
    expect(card).toContain("NOTE:Director\n");
    expect(card.endsWith("END:VCARD\n")).toBe(true);
  });
});
