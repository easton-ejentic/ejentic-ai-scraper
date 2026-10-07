import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";

export async function GET(_request: Request) {
  const __auth = await requireApiUser(_request);
  if (__auth.response) return __auth.response;

  try {
    const repository = getRepository();
    const workflows = await repository.listStoredWorkflows();
    return NextResponse.json({ workflows });
  } catch (error) {
    console.error("Error listing workflows:", error);
    return NextResponse.json(
      { error: "Failed to list workflows" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const __auth = await requireApiUser(request);
  if (__auth.response) return __auth.response;

  let body: { action?: string } = {};
  try { body = await request.json(); } catch {}
  if (body.action !== "evaluate-all") {
    return NextResponse.json({ error: "action must be evaluate-all" }, { status: 400 });
  }
  try {
    const repository = getRepository();
    const workflows = await repository.evaluateAllStoredWorkflows();
    return NextResponse.json({ workflows, count: workflows.length });
  } catch (error) {
    console.error("Error evaluating workflows:", error);
    return NextResponse.json(
      { error: "Failed to evaluate workflows" },
      { status: 500 }
    );
  }
}
