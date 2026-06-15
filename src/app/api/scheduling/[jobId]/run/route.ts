import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { executeServerCommand } from "@/server/rcon/service";

type Params = { params: Promise<{ jobId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { jobId } = await params;
  const job = await prisma.scheduledJob.findUnique({ where: { id: jobId }, include: { server: true } });
  if (!job) {
    return NextResponse.json({ error: "Scheduled job not found" }, { status: 404 });
  }

  let output: string | null = null;
  let success = true;

  try {
    output = await executeServerCommand(job.server, job.command);
  } catch (error) {
    success = false;
    output = error instanceof Error ? error.message : "Command failed";
  }

  await prisma.$transaction([
    prisma.scheduledJob.update({ where: { id: jobId }, data: { lastRunAt: new Date() } }),
    prisma.commandRun.create({
      data: {
        serverId: job.serverId,
        command: job.command,
        label: `Scheduled: ${job.name}`,
        output,
        success,
      },
    }),
  ]);

  if (!success) {
    return NextResponse.json({ error: output }, { status: 502 });
  }

  return NextResponse.json({ output });
}
