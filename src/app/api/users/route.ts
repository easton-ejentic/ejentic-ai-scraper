import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/guard";
import { createUser, listUsers, UserManagementUnavailable } from "@/lib/auth/users";
import type { Role } from "@/lib/auth/session";

const ROLES: Role[] = ["ADMIN", "OPERATOR", "RESEARCHER", "VIEWER"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const { response } = await requireApiUser(request, "ADMIN");
  if (response) return response;

  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { response } = await requireApiUser(request, "ADMIN");
  if (response) return response;

  let body: { email?: unknown; name?: unknown; role?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = ROLES.includes(body.role as Role) ? (body.role as Role) : "VIEWER";

  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  try {
    const user = await createUser({ email, name, role, password });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof UserManagementUnavailable) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    const message = error instanceof Error ? error.message : "Could not create the account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
