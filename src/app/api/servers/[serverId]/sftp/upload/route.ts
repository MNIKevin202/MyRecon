import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { joinRemotePath, uploadFile } from "@/server/sftp/service";

type Params = { params: Promise<{ serverId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  const targetDir = String(formData.get("path") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });

  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });

  const targetPath = joinRemotePath(targetDir || server.sftpRootPath || ".", file.name);
  try {
    const result = await uploadFile(server, targetPath, file);
    return NextResponse.json({
      ...result,
      pluginHint: targetPath.toLowerCase().endsWith(".cs") && targetPath === joinRemotePath(server.sftpDefaultPluginPath ?? "", file.name)
        ? "Plugin uploaded. Watch the console for compile/load results."
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to upload file",
        details: typeof error === "object" && error && "details" in error ? error.details : undefined,
      },
      { status: 502 },
    );
  }
}
