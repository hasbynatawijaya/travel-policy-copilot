"use client";

import { useState } from "react";
import type { RuleStatus } from "@/lib/policy/rules";

export function RuleReview({ policyId, ruleId, initial }: { policyId: string; ruleId: string; initial: RuleStatus }) {
  const [status, setStatus] = useState<RuleStatus>(initial);
  const [error, setError] = useState<string | null>(null);

  async function set(next: RuleStatus) {
    setError(null);
    const res = await fetch(`/api/policies/${policyId}/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      setError("Could not save. Try again.");
      return;
    }
    setStatus(next);
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-20 capitalize">{status}</span>
      <button onClick={() => set("approved")} className="rounded border px-2 py-1 hover:bg-green-50">Approve</button>
      <button onClick={() => set("rejected")} className="rounded border px-2 py-1 hover:bg-red-50">Reject</button>
      {error && <span role="alert" className="text-red-700">{error}</span>}
    </div>
  );
}
