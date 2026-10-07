import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/guard";
import { getRepository } from "@/lib/production/repository";

/**
 * Lists contact enquiries. Read-only and staff-only: these contain names,
 * email addresses and free-text messages from the public marketing form.
 */
export async function GET(request: Request) {
  const { response } = await requireApiUser(request, "VIEWER");
  if (response) return response;

  const enquiries = await getRepository().listContactEnquiries();
  return NextResponse.json({ enquiries });
}
