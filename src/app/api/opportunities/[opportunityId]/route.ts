import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import type { OpportunityRecord } from "@/lib/research/opportunity";
import { requireApiUser } from "@/lib/auth/guard";

/**
 * Reads and writes through the repository rather than the JSON store directly,
 * so the same handler works against PostgreSQL in production.
 */

type Context = { params: Promise<{ opportunityId: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { opportunityId } = await context.params;
  const repository = getRepository();
  const opportunity = await repository.getStoredOpportunity(opportunityId);
  if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  return NextResponse.json({ opportunity });
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { opportunityId } = await context.params;

  let body: { status?: OpportunityRecord["status"] } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const statuses: OpportunityRecord["status"][] = [
    "new",
    "reviewing",
    "qualified",
    "outreach",
    "won",
    "lost",
  ];
  if (!body.status || !statuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid opportunity status" }, { status: 400 });
  }

  const repository = getRepository();
  const opportunity = await repository.updateOpportunityStatus(opportunityId, body.status);
  if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  return NextResponse.json({ opportunity });
}
