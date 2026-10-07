import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guard";
import { authStatus } from "@/lib/auth/users";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    authenticated: Boolean(user),
    user,
    auth: authStatus(),
  });
}
