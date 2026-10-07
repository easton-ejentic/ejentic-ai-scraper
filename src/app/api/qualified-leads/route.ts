import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";

export async function GET(_request: Request) {
  const __auth = await requireApiUser(_request);
  if (__auth.response) return __auth.response;

  try {
    const repository = getRepository();
    const leads = await repository.listQualifiedLeads();
    return NextResponse.json({ leads, methodology: "development-threshold-v1" });
  } catch (error) {
    console.error("Error listing qualified leads:", error);
    return NextResponse.json(
      { error: "Failed to list qualified leads" },
      { status: 500 }
    );
  }
}
