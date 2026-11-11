"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PolicyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), text: form.get("text") }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.push(`/policies/${body.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Policy name
        <input name="name" required maxLength={120} className="rounded border px-3 py-2" placeholder="Example: Company travel policy 2026" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Policy text (paste; do not upload confidential documents)
        <textarea name="text" required minLength={200} maxLength={40000} rows={12} className="rounded border px-3 py-2 font-mono text-sm" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Extracting rules…" : "Extract rules"}
      </button>
    </form>
  );
}
