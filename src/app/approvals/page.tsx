import Link from "next/link";
import { Suspense } from "react";
import { ApprovalButtons } from "@/components/ApprovalButtons";
import { listPendingApprovals } from "@/lib/repo";

export default function ApprovalsPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline">← Policies</Link>
        <h1 className="text-2xl font-semibold">Approval queue</h1>
        <p className="text-sm text-neutral-700">
          Out-of-policy trips wait here. Note: v1 has no sign-in, so this page is open to anyone with the link. That is a known gap, listed in the README.
        </p>
      </header>
      <Suspense fallback={<p className="text-sm text-neutral-600">Loading…</p>}>
        <Pending />
      </Suspense>
    </main>
  );
}

async function Pending() {
  const pending = await listPendingApprovals();
  if (pending.length === 0) {
    return <p className="text-sm text-neutral-600">Nothing waiting.</p>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {pending.map((a) => (
        <li key={a.approvalId} className="flex flex-col gap-2 border-b pb-4">
          <p className="text-sm text-neutral-500">
            Trip {a.tripId.slice(0, 8)} · {a.createdAt.toLocaleString("en-GB")}
          </p>
          <ul className="list-disc pl-5 text-sm">
            {a.reasons.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <ApprovalButtons approvalId={a.approvalId} />
        </li>
      ))}
    </ul>
  );
}
