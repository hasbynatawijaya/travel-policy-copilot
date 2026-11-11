import { z } from "zod";
import { RULE_STATUSES } from "@/lib/policy/rules";
import { setRuleStatus } from "@/lib/repo";


const bodySchema = z.object({ status: z.enum(RULE_STATUSES) });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; ruleId: string }> },
) {
  const { id, ruleId } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(id).success || !z.uuid().safeParse(ruleId).success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  await setRuleStatus(ruleId, id, parsed.data.status);
  return Response.json({ ok: true });
}
