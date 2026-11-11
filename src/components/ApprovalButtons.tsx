"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalButtons({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setError(null);
    const res = await fetch(`/api/approvals/${approvalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      setError("This request was already decided.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => decide("approved")} className="rounded border px-2 py-1 hover:bg-green-50">Approve</button>
      <button onClick={() => decide("rejected")} className="rounded border px-2 py-1 hover:bg-red-50">Reject</button>
      {error && <span role="alert" className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
