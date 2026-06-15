import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/session";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return { user: null, response: jsonError("Authentication required", 401) };
  }

  return { user, response: null };
}

export function canManage(role: string) {
  return role === "OWNER" || role === "ADMIN";
}
