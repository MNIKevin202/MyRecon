import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { installPluginFromUmod } from "@/server/plugins/catalog";

type Params = { params: Promise<{ serverId: string }> };

const installSchema = z.object({
  source: z.literal("uMod").default("uMod"),
  input: z.string().trim().min(1).max(500),
  directory: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const parsed = installSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Plugin URL or filename is required" }, { status: 400 });
  }

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    const result = await installPluginFromUmod(server, parsed.data.input, parsed.data.directory);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Plugin install failed",
        details: typeof error === "object" && error && "details" in error ? error.details : undefined,
      },
      { status: 502 },
    );
  }
}
