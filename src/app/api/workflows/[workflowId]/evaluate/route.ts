import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";

export async function POST(
  _request: Request,
  context: { params: Promise<{ workflowId: string }> },
) {
  const __auth = await requireApiUser(_request);
  if (__auth.response) return __auth.response;

  const { workflowId } = await context.params;
  const workflow = await getRepository().evaluateStoredWorkflow(workflowId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  return NextResponse.json({ workflow });
}
