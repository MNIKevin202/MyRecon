import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [users, servers] = await Promise.all([
    prisma.user.count(),
    prisma.serverProfile.count(),
  ]);

  return NextResponse.json({
    needsSetup: users === 0 || servers === 0,
    hasUsers: users > 0,
    hasServers: servers > 0,
  });
}
