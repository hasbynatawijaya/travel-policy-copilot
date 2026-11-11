import { describe, expect, it } from "vitest";
import { checkOption, checkTrip, type ActiveRule } from "./engine";
import { extractionSchema } from "./rules";

const rules: ActiveRule[] = [
  { id: "r-cabin", rule: { type: "cabin_class", maxCabin: "business", sourceQuote: "x" } },
  { id: "r-flight", rule: { type: "flight_price_cap", maxAmountUsd: 800, sourceQuote: "x" } },
  { id: "r-tier1", rule: { type: "hotel_nightly_cap", cityTier: "tier1", maxNightlyUsd: 250, sourceQuote: "x" } },
  { id: "r-tier2", rule: { type: "hotel_nightly_cap", cityTier: "tier2", maxNightlyUsd: 150, sourceQuote: "x" } },
  { id: "r-advance", rule: { type: "advance_booking", minDays: 7, sourceQuote: "x" } },
  { id: "r-approval", rule: { type: "approval_required", aboveAmountUsd: 2000, sourceQuote: "x" } },
];

describe("checkOption", () => {
  it("passes a flight within every flight rule", () => {
    const verdict = checkOption(
      { kind: "flight", cabin: "economy", priceUsd: 500, daysBeforeTravel: 14 },
      rules,
    );
    expect(verdict).toEqual({ inPolicy: true, violations: [] });
  });

  it("rejects a cabin above the limit and names both cabins", () => {
    const verdict = checkOption(
      { kind: "flight", cabin: "first", priceUsd: 500, daysBeforeTravel: 14 },
      rules,
    );
    expect(verdict.inPolicy).toBe(false);
    expect(verdict.violations).toEqual([
      { ruleId: "r-cabin", reason: "first is above the business limit" },
    ]);
  });

  it("rejects a flight above the price cap", () => {
    const verdict = checkOption(
      { kind: "flight", cabin: "economy", priceUsd: 801, daysBeforeTravel: 14 },
      rules,
    );
    expect(verdict.violations.map((v) => v.ruleId)).toEqual(["r-flight"]);
  });

  it("applies the hotel cap for the hotel's own city tier only", () => {
    const tier2Over = checkOption(
      { kind: "hotel", cityTier: "tier2", nightlyUsd: 200, nights: 2, daysBeforeTravel: 14 },
      rules,
    );
    expect(tier2Over.violations.map((v) => v.ruleId)).toEqual(["r-tier2"]);

    const tier1Under = checkOption(
      { kind: "hotel", cityTier: "tier1", nightlyUsd: 200, nights: 2, daysBeforeTravel: 14 },
      rules,
    );
    expect(tier1Under.inPolicy).toBe(true);
  });

  it("fails closed when the policy has hotel caps but none for the hotel's tier", () => {
    const verdict = checkOption(
      { kind: "hotel", cityTier: "other", nightlyUsd: 50, nights: 1, daysBeforeTravel: 14 },
      rules,
    );
    expect(verdict.inPolicy).toBe(false);
    expect(verdict.violations).toEqual([
      { ruleId: "no-hotel-cap-for-tier", reason: "No nightly cap is defined for other" },
    ]);
  });

  it("does not fail closed when the policy has no hotel caps at all", () => {
    const flightOnly = rules.filter((r) => r.rule.type !== "hotel_nightly_cap");
    const verdict = checkOption(
      { kind: "hotel", cityTier: "other", nightlyUsd: 900, nights: 1, daysBeforeTravel: 14 },
      flightOnly,
    );
    expect(verdict.inPolicy).toBe(true);
  });

  it("rejects a booking made too late, for flights and hotels", () => {
    const flight = checkOption(
      { kind: "flight", cabin: "economy", priceUsd: 100, daysBeforeTravel: 3 },
      rules,
    );
    const hotel = checkOption(
      { kind: "hotel", cityTier: "tier1", nightlyUsd: 100, nights: 1, daysBeforeTravel: 3 },
      rules,
    );
    expect(flight.violations.map((v) => v.ruleId)).toEqual(["r-advance"]);
    expect(hotel.violations.map((v) => v.ruleId)).toEqual(["r-advance"]);
  });
});

describe("checkTrip", () => {
  it("does not require approval for an in-policy trip under the limit", () => {
    const verdict = checkTrip(
      [
        { kind: "flight", cabin: "economy", priceUsd: 500, daysBeforeTravel: 14 },
        { kind: "hotel", cityTier: "tier1", nightlyUsd: 200, nights: 2, daysBeforeTravel: 14 },
      ],
      rules,
    );
    expect(verdict).toEqual({ requiresApproval: false, reasons: [] });
  });

  it("requires approval when the total is above the limit, even if every option is in policy", () => {
    const verdict = checkTrip(
      [
        { kind: "flight", cabin: "business", priceUsd: 800, daysBeforeTravel: 14 },
        { kind: "hotel", cityTier: "tier1", nightlyUsd: 250, nights: 5, daysBeforeTravel: 14 },
      ],
      rules,
    );
    expect(verdict.requiresApproval).toBe(true);
    expect(verdict.reasons).toEqual([
      "Trip total USD 2050.00 is above the USD 2000 approval limit",
    ]);
  });

  it("requires approval when one option is out of policy", () => {
    const verdict = checkTrip(
      [{ kind: "flight", cabin: "first", priceUsd: 300, daysBeforeTravel: 14 }],
      rules,
    );
    expect(verdict.requiresApproval).toBe(true);
    expect(verdict.reasons).toEqual(["first is above the business limit"]);
  });
});

describe("extractionSchema", () => {
  it("accepts the closed set of rule types", () => {
    const parsed = extractionSchema.safeParse({
      rules: [{ type: "advance_booking", minDays: 7, sourceQuote: "Book 7 days ahead." }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a rule type the engine does not know", () => {
    const parsed = extractionSchema.safeParse({
      rules: [{ type: "meal_allowance", maxUsd: 30, sourceQuote: "Meals up to 30." }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a rule with no source quote", () => {
    const parsed = extractionSchema.safeParse({
      rules: [{ type: "advance_booking", minDays: 7, sourceQuote: "" }],
    });
    expect(parsed.success).toBe(false);
  });
});
