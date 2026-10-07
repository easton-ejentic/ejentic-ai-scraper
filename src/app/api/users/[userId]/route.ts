import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/guard";
import { deleteUser, updateUser, UserManagementUnavailable } from "@/lib/auth/users";
import type { Role } from "@/lib/auth/session";

const ROLES: Role[] = ["ADMIN", "OPERATOR", "RESEARCHER", "VIEWER"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { response } = await requireApiUser(request, "ADMIN");
  if (response) return response;

  const { userId } = await params;

  let body: { name?: unknown; role?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: { name?: string; role?: Role; password?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (ROLES.includes(body.role as Role)) patch.role = body.role as Role;
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    patch.password = body.password;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const user = await updateUser(userId, patch);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof UserManagementUnavailable) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    const message = error instanceof Error ? error.message : "Could not update the account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { response } = await requireApiUser(request, "ADMIN");
  if (response) return response;

  const { userId } = await params;

  try {
    await deleteUser(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserManagementUnavailable) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    const message = error instanceof Error ? error.message : "Could not delete the account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
