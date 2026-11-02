import { describe, expect, it } from "vitest";
import { CONTACT_PLACEHOLDER, redactContactInfo } from "./contact-redaction";

describe("contact redaction in messages", () => {
  it("hides email addresses", () => {
    expect(redactContactInfo("write me at marta.vidal@gmail.com ok")).toBe(
      `write me at ${CONTACT_PLACEHOLDER} ok`,
    );
  });

  it("hides international phone numbers", () => {
    expect(redactContactInfo("call +351 912 345 678")).toBe(`call ${CONTACT_PLACEHOLDER}`);
  });

  it("hides US style phone numbers", () => {
    expect(redactContactInfo("(555) 123-4567")).toBe(CONTACT_PLACEHOLDER);
  });

  it("keeps dates and prices readable", () => {
    const text = "Can I have it 2027-04-12 - 2027-04-15 for 480 EUR?";
    expect(redactContactInfo(text)).toBe(text);
  });
});
