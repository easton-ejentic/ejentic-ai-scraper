import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";
import { requireApiUser } from "@/lib/auth/guard";

/**
 * Reads through the repository rather than the JSON store directly, so this
 * handler works unchanged against PostgreSQL in production.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string }> },
) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const { companyId } = await context.params;
  const repository = getRepository();
  const result = await repository.getStoredCompany(companyId);
  if (!result) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json(result);
}
