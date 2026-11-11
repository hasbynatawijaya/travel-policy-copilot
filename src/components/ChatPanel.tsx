"use client";

import { useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };
type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; isError: boolean }
  | { type: "error"; message: string }
  | { type: "done" };

export function ChatPanel({ policyId }: { policyId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;

    const history = turns;
    setTurns([...history, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setNotice(null);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId, message, history }),
    });
    if (!res.ok || !res.body) {
      setNotice("The chat is unavailable right now.");
      setBusy(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";

    const apply = (ev: StreamEvent) => {
      if (ev.type === "text") {
        reply += ev.text;
        setTurns((t) => replaceLast(t, reply));
      } else if (ev.type === "tool") {
        setNotice(ev.isError ? `Tool ${ev.name} failed` : `Checked: ${ev.name}`);
      } else if (ev.type === "error") {
        setNotice(ev.message);
      }
    };

    // A stream can split an event across reads, so keep the partial line.
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        apply(JSON.parse(line.slice(6)) as StreamEvent);
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {turns.map((t, i) => (
          <li key={i} className={t.role === "user" ? "text-right" : ""}>
            <span className="whitespace-pre-wrap rounded bg-neutral-100 px-3 py-2 text-sm inline-block max-w-prose">
              {t.content || (busy && i === turns.length - 1 ? "…" : "")}
            </span>
          </li>
        ))}
      </ol>
      {notice && <p role="status" className="text-sm text-neutral-700">{notice}</p>}
      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          aria-label="Message"
          placeholder="e.g. Flight from CGK to SIN, economy, booked 14 days ahead"
          className="flex-1 rounded border px-3 py-2"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}

function replaceLast(turns: Turn[], content: string): Turn[] {
  const copy = turns.slice();
  const last = copy[copy.length - 1];
  if (last) copy[copy.length - 1] = { ...last, content };
  return copy;
}
