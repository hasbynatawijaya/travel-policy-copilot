import { CABIN_CLASSES, type CabinClass, type PolicyRule } from "./rules";

// Deterministic compliance check. No LLM and no I/O here: the LLM proposes
// rules, a human approves them, and this function decides.

export type ActiveRule = { id: string; rule: PolicyRule };

export type FlightOption = {
  kind: "flight";
  cabin: CabinClass;
  priceUsd: number;
  daysBeforeTravel: number;
};

export type HotelOption = {
  kind: "hotel";
  cityTier: string;
  nightlyUsd: number;
  nights: number;
  daysBeforeTravel: number;
};

export type Option = FlightOption | HotelOption;

export type Violation = { ruleId: string; reason: string };

export type Verdict = {
  inPolicy: boolean;
  violations: Violation[];
};

export type TripVerdict = {
  requiresApproval: boolean;
  reasons: string[];
};

export function checkOption(option: Option, rules: ActiveRule[]): Verdict {
  const violations: Violation[] = [];

  for (const { id, rule } of rules) {
    const reason = violationOf(option, rule);
    if (reason) violations.push({ ruleId: id, reason });
  }

  if (option.kind === "hotel" && hasNoCapForTier(option, rules)) {
    violations.push({
      ruleId: "no-hotel-cap-for-tier",
      reason: `No nightly cap is defined for ${option.cityTier}`,
    });
  }

  return { inPolicy: violations.length === 0, violations };
}

// Trip-level check: approval is needed when the total is above a limit, or
// when any option is out of policy.
export function checkTrip(
  options: Option[],
  rules: ActiveRule[],
): TripVerdict {
  const reasons: string[] = [];
  const total = options.reduce((sum, o) => sum + spendOf(o), 0);

  for (const { rule } of rules) {
    if (rule.type === "approval_required" && total > rule.aboveAmountUsd) {
      reasons.push(
        `Trip total USD ${total.toFixed(2)} is above the USD ${rule.aboveAmountUsd} approval limit`,
      );
    }
  }

  for (const option of options) {
    const verdict = checkOption(option, rules);
    if (!verdict.inPolicy) {
      reasons.push(...verdict.violations.map((v) => v.reason));
    }
  }

  return { requiresApproval: reasons.length > 0, reasons };
}

function spendOf(option: Option): number {
  return option.kind === "flight"
    ? option.priceUsd
    : option.nightlyUsd * option.nights;
}

// Returns a reason when this rule rejects this option, or null when it passes
// or doesn't apply to the option's kind.
function violationOf(option: Option, rule: PolicyRule): string | null {
  switch (rule.type) {
    case "cabin_class": {
      if (option.kind !== "flight") return null;
      if (rankOf(option.cabin) > rankOf(rule.maxCabin)) {
        return `${label(option.cabin)} is above the ${label(rule.maxCabin)} limit`;
      }
      return null;
    }
    case "flight_price_cap": {
      if (option.kind !== "flight") return null;
      if (option.priceUsd > rule.maxAmountUsd) {
        return `Flight USD ${option.priceUsd} is above the USD ${rule.maxAmountUsd} cap`;
      }
      return null;
    }
    case "hotel_nightly_cap": {
      if (option.kind !== "hotel") return null;
      if (option.cityTier !== rule.cityTier) return null;
      if (option.nightlyUsd > rule.maxNightlyUsd) {
        return `Hotel USD ${option.nightlyUsd}/night is above the USD ${rule.maxNightlyUsd} cap for ${rule.cityTier}`;
      }
      return null;
    }
    case "advance_booking": {
      if (option.daysBeforeTravel < rule.minDays) {
        return `Booked ${option.daysBeforeTravel} days ahead; policy needs ${rule.minDays}`;
      }
      return null;
    }
    case "approval_required": {
      // Handled at trip level in checkTrip. Per-option it never rejects.
      return null;
    }
  }
}

// Fail closed: a hotel whose city tier has no cap, when the policy does define
// hotel caps, is out of policy.
export function hasNoCapForTier(
  option: HotelOption,
  rules: ActiveRule[],
): boolean {
  const hotelCaps = rules.filter((r) => r.rule.type === "hotel_nightly_cap");
  if (hotelCaps.length === 0) return false;
  return !hotelCaps.some(
    (r) => r.rule.type === "hotel_nightly_cap" && r.rule.cityTier === option.cityTier,
  );
}

function rankOf(cabin: CabinClass): number {
  return CABIN_CLASSES.indexOf(cabin);
}

function label(cabin: string): string {
  return cabin.replace("_", " ");
}
