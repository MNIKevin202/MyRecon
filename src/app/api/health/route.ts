import { NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/prisma";

export async function GET() {
  await ensureDatabase();
  return NextResponse.json({ ok: true, service: "myrcon" });
}
