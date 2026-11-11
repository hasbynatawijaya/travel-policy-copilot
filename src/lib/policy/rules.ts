import { z } from "zod";

// The closed set of rule types. The LLM can only produce these shapes, so a
// hallucinated rule type fails validation instead of reaching the engine.
// All amounts are in USD in v1 (see README: single currency).

export const CABIN_CLASSES = [
  "economy",
  "premium_economy",
  "business",
  "first",
] as const;
export type CabinClass = (typeof CABIN_CLASSES)[number];

const sourceQuote = z.string().min(1).max(500);

export const ruleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("cabin_class"),
    maxCabin: z.enum(CABIN_CLASSES),
    sourceQuote,
  }),
  z.object({
    type: z.literal("flight_price_cap"),
    maxAmountUsd: z.number().positive(),
    sourceQuote,
  }),
  z.object({
    type: z.literal("hotel_nightly_cap"),
    // City tiers as the policy defines them, e.g. "tier1", "tier2", "other".
    cityTier: z.string().min(1).max(40),
    maxNightlyUsd: z.number().positive(),
    sourceQuote,
  }),
  z.object({
    type: z.literal("advance_booking"),
    minDays: z.number().int().nonnegative(),
    sourceQuote,
  }),
  z.object({
    type: z.literal("approval_required"),
    // Trips whose total spend is above this need approval, whatever else applies.
    aboveAmountUsd: z.number().positive(),
    sourceQuote,
  }),
]);
export type PolicyRule = z.infer<typeof ruleSchema>;
export type RuleType = PolicyRule["type"];

export const extractionSchema = z.object({
  rules: z.array(ruleSchema).max(50),
});
export type Extraction = z.infer<typeof extractionSchema>;

export const RULE_STATUSES = ["draft", "approved", "rejected"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];
