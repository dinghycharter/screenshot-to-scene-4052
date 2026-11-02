import { describe, expect, it } from "vitest";
import { isRangeBookable } from "./availability";

const available = [{ start_date: "2027-04-10", end_date: "2027-04-30" }];
const booked = [{ start_date: "2027-04-17", end_date: "2027-04-20" }];

describe("bookable date ranges", () => {
  it("accepts dates inside an availability window", () => {
    expect(isRangeBookable("2027-04-10", "2027-04-16", available, booked)).toBe(true);
  });
  it("rejects dates outside the availability window", () => {
    expect(isRangeBookable("2027-04-28", "2027-05-02", available, booked)).toBe(false);
  });
  it("rejects dates overlapping a confirmed booking", () => {
    expect(isRangeBookable("2027-04-15", "2027-04-17", available, booked)).toBe(false);
  });
});
