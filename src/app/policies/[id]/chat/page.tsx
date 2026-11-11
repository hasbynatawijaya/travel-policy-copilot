import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { getPolicy } from "@/lib/repo";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-neutral-600">Loading…</p>}>
      <Chat params={params} />
    </Suspense>
  );
}

async function Chat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getPolicy(id).catch(() => null);
  if (!found) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <Link href={`/policies/${id}`} className="text-sm underline">← {found.policy.name}</Link>
        <h1 className="text-xl font-semibold">Book a trip</h1>
        <p className="text-sm text-neutral-700">
          Mock inventory (synthetic, USD). Bookings are checked against approved rules only.
        </p>
      </header>
      <ChatPanel policyId={id} />
    </main>
  );
}
