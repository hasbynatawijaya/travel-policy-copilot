import Link from "next/link";
import { Suspense } from "react";
import { PolicyForm } from "@/components/PolicyForm";
import { listPolicies } from "@/lib/repo";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Travel Policy Copilot</h1>
        <p className="text-sm text-neutral-700">
          Paste a travel policy. An LLM proposes rules; an admin approves them; a deterministic engine checks every booking. The LLM never decides compliance.
        </p>
        <p className="text-sm">
          <Link href="/approvals" className="underline">Approval queue</Link>
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">New policy</h2>
        <PolicyForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Policies</h2>
        <Suspense fallback={<p className="text-sm text-neutral-600">Loading policies…</p>}>
          <PolicyList />
        </Suspense>
      </section>
    </main>
  );
}

async function PolicyList() {
  const policies = await listPolicies();
  if (policies.length === 0) {
    return <p className="text-sm text-neutral-600">No policies yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {policies.map((p) => (
        <li key={p.id}>
          <Link href={`/policies/${p.id}`} className="underline">{p.name}</Link>
          <span className="ml-2 text-neutral-500">{p.createdAt.toLocaleDateString("en-GB")}</span>
        </li>
      ))}
    </ul>
  );
}
