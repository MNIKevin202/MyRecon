import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sftpMkdirSchema } from "@/lib/validators";
import { deleteRemotePath } from "@/server/sftp/service";

type Params = { params: Promise<{ serverId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;
  const { serverId } = await params;
  const parsed = sftpMkdirSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Path is required" }, { status: 400 });
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  try {
    return NextResponse.json(await deleteRemotePath(server, parsed.data.path));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete path", details: typeof error === "object" && error && "details" in error ? error.details : undefined }, { status: 502 });
  }
}
