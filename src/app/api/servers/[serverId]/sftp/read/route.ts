import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sftpReadWriteSchema } from "@/lib/validators";
import { readTextFile } from "@/server/sftp/service";

type Params = { params: Promise<{ serverId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const parsed = sftpReadWriteSchema.pick({ path: true }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Path is required" }, { status: 400 });

  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  try {
    return NextResponse.json(await readTextFile(server, parsed.data.path));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to read file",
        details: typeof error === "object" && error && "details" in error ? error.details : undefined,
      },
      { status: 502 },
    );
  }
}
