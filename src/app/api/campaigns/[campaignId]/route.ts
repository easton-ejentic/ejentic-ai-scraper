import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";
import { CampaignValidationError } from "@/lib/research/campaign";

type Context = { params: Promise<{ campaignId: string }> };

export async function GET(request: Request, { params }: Context) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  try {
    const { campaignId } = await params;
    const repository = getRepository();
    const campaign = await repository.getStoredCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Include the jobs filed under this campaign so the detail view can show
    // progress without a second round trip.
    const jobs = await repository.listStoredJobs();
    return NextResponse.json({
      campaign,
      jobs: jobs.filter((job) => job.campaignId === campaignId),
    });
  } catch (error) {
    console.error("Error reading campaign:", error);
    return NextResponse.json({ error: "Failed to read campaign" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await requireApiUser(request, "OPERATOR");
  if (auth.response) return auth.response;

  try {
    const { campaignId } = await params;
    const body = await request.json().catch(() => null);
    const repository = getRepository();
    const campaign = await repository.updateStoredCampaign(campaignId, body);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const summary = await repository.getStoredCampaign(campaignId);
    return NextResponse.json({ campaign: summary ?? campaign });
  } catch (error) {
    if (error instanceof CampaignValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating campaign:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await requireApiUser(request, "ADMIN");
  if (auth.response) return auth.response;

  try {
    const { campaignId } = await params;
    const repository = getRepository();
    const deleted = await repository.deleteStoredCampaign(campaignId);
    if (!deleted) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
