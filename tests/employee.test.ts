import { describe, expect, it } from "vitest";
import { normalizeEmployee } from "../src/employee.js";

describe("normalizeEmployee", () => {
  it("normalizes a valid employee and Indian mobile number", () => {
    const employee = normalizeEmployee({
      firstName: "  Maya ",
      lastName: " Rao  ",
      jobTitle: " Director ",
      email: " MAYA.RAO@EQUINOXGROUP.IN ",
      mobile: "90000 00000",
    });

    expect(employee).toMatchObject({
      fullName: "Maya Rao",
      jobTitle: "Director",
      email: "maya.rao@equinoxgroup.in",
      displayMobile: "+91-90000-00000",
      normalizedPhone: "+919000000000",
      fileSlug: "maya-rao",
      fileStem: "Maya-Rao",
    });
  });

  it("rejects invalid and unexpected data", () => {
    expect(() =>
      normalizeEmployee({
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Director",
        email: "not-an-email",
        mobile: "123",
      }),
    ).toThrow();

    expect(() =>
      normalizeEmployee({
        firstName: "John",
        lastName: "Smith",
        jobTitle: "Director",
        email: "john@example.com",
        mobile: "+91 90000 00000",
        extra: "not allowed",
      } as never),
    ).toThrow();
  });
});
