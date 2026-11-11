import { z } from "zod";
import { decideApproval } from "@/lib/repo";


const bodySchema = z.object({ decision: z.enum(["approved", "rejected"]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(id).success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const decided = await decideApproval(id, parsed.data.decision);
  if (!decided) return Response.json({ error: "Already decided" }, { status: 409 });
  return Response.json({ ok: true });
}
