import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, destroyCurrentSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  await destroyCurrentSession(request);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
