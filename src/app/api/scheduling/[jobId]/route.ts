import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { scheduledJobSchema } from "@/lib/validators";

type Params = { params: Promise<{ jobId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { jobId } = await params;
  const parsed = scheduledJobSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scheduled job data" }, { status: 400 });
  }

  const server = await prisma.serverProfile.findUnique({ where: { id: parsed.data.serverId } });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  const job = await prisma.scheduledJob.update({
    where: { id: jobId },
    data: {
      serverId: parsed.data.serverId,
      name: parsed.data.name,
      cron: parsed.data.cron,
      command: parsed.data.command,
      status: parsed.data.status,
    },
    include: { server: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ job });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { jobId } = await params;
  await prisma.scheduledJob.delete({ where: { id: jobId } });

  return NextResponse.json({ ok: true });
}
