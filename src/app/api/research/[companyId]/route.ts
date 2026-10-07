export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";

/**
 * The research dossier for one company, in a single round trip.
 *
 * Everything returned here is traceable: every evidence row carries the URL it
 * was taken from, and every workflow carries the evidence ids that support it.
 * The UI shows those links so a reviewer can check a claim rather than trust it.
 */
export async function GET(request: Request, context: { params: Promise<{ companyId: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  try {
    const { companyId } = await context.params;
    const repository = getRepository();

    const record = await repository.getStoredCompany(companyId);
    if (!record) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const [workflows, opportunities] = await Promise.all([
      repository.listStoredWorkflows(),
      repository.listStoredOpportunities(),
    ]);

    const companyWorkflows = workflows.filter((workflow) => workflow.companyId === companyId);
    const workflowIds = new Set(companyWorkflows.map((workflow) => workflow.id));
    const companyOpportunities = opportunities.filter((item) => workflowIds.has(item.workflowId));

    return NextResponse.json({
      company: record.company,
      evidence: record.evidence,
      workflows: companyWorkflows,
      opportunities: companyOpportunities,
    });
  } catch (error) {
    console.error("Error building research dossier:", error);
    return NextResponse.json({ error: "Failed to build research dossier" }, { status: 500 });
  }
}
