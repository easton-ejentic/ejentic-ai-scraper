import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";

export async function POST(_request: Request) {
  const __auth = await requireApiUser(_request);
  if (__auth.response) return __auth.response;

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
