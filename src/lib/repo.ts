import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ActiveRule } from "./policy/engine";
import type { Option, TripVerdict, Verdict } from "./policy/engine";
import type { Extraction, PolicyRule, RuleStatus } from "./policy/rules";

// All database access for the app lives here, so routes and pages stay thin.

export async function createPolicy(name: string, sourceText: string, extraction: Extraction) {
  return db.transaction(async (tx) => {
    const [policy] = await tx
      .insert(schema.policies)
      .values({ name, sourceText })
      .returning({ id: schema.policies.id });
    if (!policy) throw new Error("Insert returned no policy row");

    if (extraction.rules.length > 0) {
      await tx.insert(schema.policyRules).values(
        extraction.rules.map((rule) => ({
          policyId: policy.id,
          rule,
          type: rule.type,
          sourceQuote: rule.sourceQuote,
        })),
      );
    }
    return policy.id;
  });
}

export async function listPolicies() {
  return db
    .select({ id: schema.policies.id, name: schema.policies.name, createdAt: schema.policies.createdAt })
    .from(schema.policies)
    .orderBy(desc(schema.policies.createdAt));
}

export async function getPolicy(id: string) {
  const [policy] = await db.select().from(schema.policies).where(eq(schema.policies.id, id));
  if (!policy) return null;
  const rules = await db
    .select()
    .from(schema.policyRules)
    .where(eq(schema.policyRules.policyId, id));
  return { policy, rules };
}

export async function setRuleStatus(ruleId: string, policyId: string, status: RuleStatus) {
  await db
    .update(schema.policyRules)
    .set({ status, reviewedAt: new Date() })
    .where(and(eq(schema.policyRules.id, ruleId), eq(schema.policyRules.policyId, policyId)));
}

// Only approved rules reach the engine. Drafts and rejected rules never do.
export async function loadApprovedRules(policyId: string): Promise<ActiveRule[]> {
  const rows = await db
    .select()
    .from(schema.policyRules)
    .where(and(eq(schema.policyRules.policyId, policyId), eq(schema.policyRules.status, "approved")));
  return rows.map((row) => ({ id: row.id, rule: row.rule as PolicyRule }));
}

export async function saveBooking(
  policyId: string,
  input: { options: Option[]; optionVerdicts: Verdict[]; verdict: TripVerdict },
) {
  const { optionVerdicts, verdict: tripVerdict } = input;
  const status = tripVerdict.requiresApproval ? "pending_approval" : "booked";

  return db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(schema.trips)
      .values({
        policyId,
        options: input.options,
        optionVerdicts,
        tripVerdict,
        status,
      })
      .returning({ id: schema.trips.id });
    if (!trip) throw new Error("Insert returned no trip row");

    if (status === "pending_approval") {
      await tx.insert(schema.approvalRequests).values({ tripId: trip.id });
    }
    return { tripId: trip.id, status } as const;
  });
}

export async function listPendingApprovals() {
  return db
    .select({
      approvalId: schema.approvalRequests.id,
      tripId: schema.trips.id,
      reasons: schema.trips.tripVerdict,
      createdAt: schema.approvalRequests.createdAt,
    })
    .from(schema.approvalRequests)
    .innerJoin(schema.trips, eq(schema.trips.id, schema.approvalRequests.tripId))
    .where(eq(schema.approvalRequests.status, "pending"))
    .orderBy(desc(schema.approvalRequests.createdAt));
}

export async function decideApproval(approvalId: string, decision: "approved" | "rejected") {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(schema.approvalRequests)
      .set({ status: decision, decidedAt: new Date() })
      .where(and(eq(schema.approvalRequests.id, approvalId), eq(schema.approvalRequests.status, "pending")))
      .returning({ tripId: schema.approvalRequests.tripId });
    if (!row) return false;
    await tx.update(schema.trips).set({ status: decision }).where(eq(schema.trips.id, row.tripId));
    return true;
  });
}

export async function recordUsage(entry: {
  kind: "extract" | "chat";
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}) {
  await db.insert(schema.llmUsage).values(entry);
}
