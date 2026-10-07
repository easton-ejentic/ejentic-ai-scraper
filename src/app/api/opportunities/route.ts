import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";

export async function GET(_request: Request) {
  const __auth = await requireApiUser(_request);
  if (__auth.response) return __auth.response;

  try {
    const repository = getRepository();
    const opportunities = await repository.listStoredOpportunities();
    return NextResponse.json({ opportunities });
  } catch (error) {
    console.error("Error listing opportunities:", error);
    return NextResponse.json(
      { error: "Failed to list opportunities" },
      { status: 500 }
    );
  }
}

export async function POST(_request: Request) {
  const __auth = await requireApiUser(_request);
  if (__auth.response) return __auth.response;

  try {
    const repository = getRepository();
    const opportunities = await repository.generateAllStoredOpportunities();
    return NextResponse.json({ opportunities });
  } catch (error) {
    console.error("Error generating opportunities:", error);
    return NextResponse.json(
      { error: "Failed to generate opportunities" },
      { status: 500 }
    );
  }
}
