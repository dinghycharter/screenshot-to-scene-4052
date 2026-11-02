import { describe, expect, it } from "vitest";
import { calculateBookingTotal, countCharterDays } from "./booking";

describe("booking pricing", () => {
  it("counts charter days inclusively", () => {
    expect(countCharterDays("2027-03-27", "2027-04-03")).toBe(8);
  });

  it("a same-day charter is one day", () => {
    expect(countCharterDays("2027-06-19", "2027-06-19")).toBe(1);
  });

  it("total is days times daily price", () => {
    expect(calculateBookingTotal("2027-04-17", "2027-04-24", 60)).toBe(480);
  });

  it("an end date before the start costs nothing", () => {
    expect(calculateBookingTotal("2027-04-24", "2027-04-17", 60)).toBe(0);
  });
});
