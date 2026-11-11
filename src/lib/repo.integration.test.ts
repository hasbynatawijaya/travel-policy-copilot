import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { checkOption, checkTrip, type Option } from "./policy/engine";
import { createPolicy, decideApproval, loadApprovedRules, listPendingApprovals, saveBooking, setRuleStatus } from "./repo";
import type { Extraction } from "./policy/rules";

// Runs only when a database is configured (DATABASE_URL in .env.local).
const hasDb = Boolean(process.env.DATABASE_URL);

const extraction: Extraction = {
  rules: [
    { type: "flight_price_cap", maxAmountUsd: 800, sourceQuote: "Flights up to USD 800." },
    { type: "advance_booking", minDays: 7, sourceQuote: "Book at least 7 days ahead." },
  ],
};

describe.skipIf(!hasDb)("repo against Postgres", () => {
  const createdPolicies: string[] = [];

  afterAll(async () => {
    for (const id of createdPolicies) {
      await db.delete(schema.policies).where(eq(schema.policies.id, id));
    }
  });

  it("saves an out-of-policy trip as pending and records one approval request", async () => {
    const policyId = await createPolicy("Integration test policy", "x".repeat(200), extraction);
    createdPolicies.push(policyId);

    const rows = await db.select().from(schema.policyRules).where(eq(schema.policyRules.policyId, policyId));
    for (const row of rows) await setRuleStatus(row.id, policyId, "approved");

    const rules = await loadApprovedRules(policyId);
    expect(rules).toHaveLength(2);

    const options: Option[] = [{ kind: "flight", cabin: "economy", priceUsd: 950, daysBeforeTravel: 3 }];
    const optionVerdicts = options.map((o) => checkOption(o, rules));
    const verdict = checkTrip(options, rules);
    const saved = await saveBooking(policyId, { options, optionVerdicts, verdict });

    expect(saved.status).toBe("pending_approval");
    const pending = await listPendingApprovals();
    expect(pending.some((p) => p.tripId === saved.tripId)).toBe(true);

    const approval = pending.find((p) => p.tripId === saved.tripId);
    expect(approval).toBeDefined();
    expect(await decideApproval(approval!.approvalId, "approved")).toBe(true);
    // A second decision on the same request is refused.
    expect(await decideApproval(approval!.approvalId, "rejected")).toBe(false);

    const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, saved.tripId));
    expect(trip?.status).toBe("approved");
  });

  it("books an in-policy trip straight away with no approval request", async () => {
    const policyId = await createPolicy("Integration test policy 2", "y".repeat(200), extraction);
    createdPolicies.push(policyId);
    const rows = await db.select().from(schema.policyRules).where(eq(schema.policyRules.policyId, policyId));
    for (const row of rows) await setRuleStatus(row.id, policyId, "approved");
    const rules = await loadApprovedRules(policyId);

    const options: Option[] = [{ kind: "flight", cabin: "economy", priceUsd: 500, daysBeforeTravel: 14 }];
    const saved = await saveBooking(policyId, {
      options,
      optionVerdicts: options.map((o) => checkOption(o, rules)),
      verdict: checkTrip(options, rules),
    });
    expect(saved.status).toBe("booked");
  });

  it("ignores draft and rejected rules", async () => {
    const policyId = await createPolicy("Integration test policy 3", "z".repeat(200), extraction);
    createdPolicies.push(policyId);
    const rows = await db.select().from(schema.policyRules).where(eq(schema.policyRules.policyId, policyId));
    await setRuleStatus(rows[0]!.id, policyId, "approved");
    await setRuleStatus(rows[1]!.id, policyId, "rejected");
    const rules = await loadApprovedRules(policyId);
    expect(rules.map((r) => r.rule.type)).toEqual(["flight_price_cap"]);
  });
});
