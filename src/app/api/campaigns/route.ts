import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";
import { CampaignValidationError } from "@/lib/research/campaign";

/**
 * Campaigns are the container users file discovery work under. They are plain
 * persisted records - no crawling happens here, so these handlers stay fast.
 */

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  try {
    const repository = getRepository();
    const campaigns = await repository.listStoredCampaigns();
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Error listing campaigns:", error);
    return NextResponse.json({ error: "Failed to list campaigns" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request, "OPERATOR");
  if (auth.response) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const repository = getRepository();
    const campaign = await repository.createStoredCampaign(body);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof CampaignValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating campaign:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
