import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/guard";
import { getRepository } from "@/lib/production/repository";

const STATUSES = ["new", "read", "archived"] as const;

/** Moves an enquiry between new / read / archived. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ enquiryId: string }> },
) {
  const { response } = await requireApiUser(request, "OPERATOR");
  if (response) return response;

  const { enquiryId } = await params;

  let body: { status?: unknown };
  try {
    body = (await request.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.status;
  if (typeof status !== "string" || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const updated = await getRepository().updateContactEnquiryStatus(
    enquiryId,
    status as (typeof STATUSES)[number],
  );

  if (!updated) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  return NextResponse.json({ enquiry: updated });
}
