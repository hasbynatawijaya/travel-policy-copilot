import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ExtractionFailed, ExtractionRefused, extractRules } from "@/lib/policy/extract";
import { createPolicy, recordUsage } from "@/lib/repo";

export const maxDuration = 60;

// Uploads are capped so one request stays inside the function time limit.
const MAX_POLICY_CHARS = 40_000;

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  text: z.string().trim().min(200).max(MAX_POLICY_CHARS),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Give a policy name and between 200 and 40,000 characters of policy text." },
      { status: 400 },
    );
  }

  const started = Date.now();
  try {
    const { extraction, inputTokens, outputTokens } = await extractRules(
      new Anthropic(),
      parsed.data.text,
    );
    await recordUsage({
      kind: "extract",
      model: "claude-opus-5-5",
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - started,
    });
    const id = await createPolicy(parsed.data.name, parsed.data.text, extraction);
    return Response.json({ id, ruleCount: extraction.rules.length }, { status: 201 });
  } catch (e) {
    if (e instanceof ExtractionRefused) {
      return Response.json({ error: "The model declined to read this policy." }, { status: 422 });
    }
    if (e instanceof ExtractionFailed) {
      return Response.json({ error: e.message }, { status: 422 });
    }
    console.error("policy extraction failed", e);
    return Response.json({ error: "Extraction failed. Try again." }, { status: 500 });
  }
}
