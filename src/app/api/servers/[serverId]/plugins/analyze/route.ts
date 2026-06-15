import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { analyzePluginSource } from "@/server/plugins/analyzer";

type Params = { params: Promise<{ serverId: string }> };

const schema = z.object({
  path: z.string().trim().min(1).max(2000),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Plugin path is required" }, { status: 400 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    const analysis = await analyzePluginSource(server, parsed.data.path);
    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Plugin analysis failed",
        details: typeof error === "object" && error && "details" in error ? error.details : undefined,
      },
      { status: 502 },
    );
  }
}
