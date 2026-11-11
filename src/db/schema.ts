import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { RuleStatus } from "@/lib/policy/rules";
import type { Option, Verdict, TripVerdict } from "@/lib/policy/engine";

export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // Policy text only. The uploaded file itself is not stored.
  sourceText: text("source_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const policyRules = pgTable("policy_rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id, { onDelete: "cascade" }),
  // The rule as validated by ruleSchema. Stored whole so the engine reads the
  // same shape the extractor produced.
  rule: jsonb("rule").notNull(),
  type: text("type").notNull(),
  sourceQuote: text("source_quote").notNull(),
  status: text("status").$type<RuleStatus>().notNull().default("draft"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id, { onDelete: "cascade" }),
  options: jsonb("options").$type<Option[]>().notNull(),
  // Snapshot of the verdict at booking time, so later rule changes don't
  // silently rewrite what was decided.
  optionVerdicts: jsonb("option_verdicts").$type<Verdict[]>().notNull(),
  tripVerdict: jsonb("trip_verdict").$type<TripVerdict>().notNull(),
  status: text("status")
    .$type<"booked" | "pending_approval" | "approved" | "rejected">()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const llmUsage = pgTable("llm_usage", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  kind: text("kind").notNull(), // "extract" | "chat"
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  // Synthetic data is labelled as synthetic in the results.
  dataset: text("dataset").notNull(),
  model: text("model").notNull(),
  // Precision and recall per rule type, plus the misses.
  summary: jsonb("summary").notNull(),
  // The approved flag lives in the row so a run can't be published by mistake.
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
