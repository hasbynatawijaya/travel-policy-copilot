import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RuleReview } from "@/components/RuleReview";
import { getPolicy } from "@/lib/repo";

export default function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-neutral-600">Loading…</p>}>
      <PolicyDetail params={params} />
    </Suspense>
  );
}

async function PolicyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getPolicy(id).catch(() => null);
  if (!found) notFound();

  const approved = found.rules.filter((r) => r.status === "approved").length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm underline">← Policies</Link>
        <h1 className="text-2xl font-semibold">{found.policy.name}</h1>
        <p className="text-sm text-neutral-700">
          {approved} of {found.rules.length} rules approved. Only approved rules affect bookings.
        </p>
        <p className="text-sm">
          <Link href={`/policies/${id}/chat`} className="underline">Open the booking chat</Link>
        </p>
      </header>

      <ul className="flex flex-col gap-5">
        {found.rules.map((rule) => (
          <li key={rule.id} className="flex flex-col gap-2 border-b pb-4">
            <p className="text-sm font-medium">{rule.type.replaceAll("_", " ")}</p>
            <pre className="overflow-x-auto rounded bg-neutral-100 p-2 text-xs">{JSON.stringify(rule.rule, null, 2)}</pre>
            <blockquote className="border-l-2 pl-3 text-sm text-neutral-700">“{rule.sourceQuote}”</blockquote>
            <RuleReview policyId={id} ruleId={rule.id} initial={rule.status} />
          </li>
        ))}
        {found.rules.length === 0 && (
          <li className="text-sm text-neutral-600">The model found no rules in this text.</li>
        )}
      </ul>
    </main>
  );
}
