import { NextResponse } from "next/server";
import { getRepository } from "@/lib/production/repository";

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  market?: unknown;
  message?: unknown;
  interest?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/**
 * Accepts marketing-site contact submissions and stores them.
 *
 * Enquiries are persisted through the repository, so they survive a restart
 * and are readable from Settings → Enquiries. No email provider is wired up;
 * if outbound notification is needed later it belongs here, after the write.
 */
export async function POST(request: Request) {
  let payload: ContactPayload;

  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = asString(payload.name, 120);
  const email = asString(payload.email, 200);
  const company = asString(payload.company, 160);
  const market = asString(payload.market, 200);
  const message = asString(payload.message, 4000);
  const interest = asString(payload.interest, 80);

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }

  try {
    const enquiry = await getRepository().createContactEnquiry({
      name,
      email,
      company: company || undefined,
      market: market || undefined,
      interest: interest || undefined,
      message,
    });

    return NextResponse.json({ ok: true, id: enquiry.id }, { status: 201 });
  } catch (error) {
    // Never leak database internals to a public form.
    console.error("[contact] failed to store enquiry", error);
    return NextResponse.json(
      { error: "We could not record your enquiry. Please try again later." },
      { status: 500 },
    );
  }
}
