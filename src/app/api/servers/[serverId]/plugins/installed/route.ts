import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { listInstalledPlugins } from "@/server/plugins/catalog";

type Params = { params: Promise<{ serverId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const directory = request.nextUrl.searchParams.get("directory") ?? undefined;
  try {
    const result = await listInstalledPlugins(server, directory);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to list installed plugins",
        details: typeof error === "object" && error && "details" in error ? error.details : undefined,
      },
      { status: 502 },
    );
  }
}
