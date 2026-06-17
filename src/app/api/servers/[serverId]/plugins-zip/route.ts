import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createZip } from "@/server/zip";
import { downloadPluginFiles } from "@/server/sftp/service";

type Params = { params: Promise<{ serverId: string }> };

// GET /api/servers/[serverId]/plugins-zip
// Streams a .zip of every .cs plugin in the server's plugin directory
// (MyRcon exclusive + uMod/Oxide + any other installed plugin) so the admin
// can install them manually.
export async function GET(request: NextRequest, { params }: Params) {
  const { response } = await requireUser(request);
  if (response) return response;

  const { serverId } = await params;
  const server = await prisma.serverProfile.findUnique({ where: { id: serverId } });
  if (!server) return NextResponse.json({ error: "Server not found" }, { status: 404 });
  if (!server.sftpEnabled) {
    return NextResponse.json(
      { error: "SFTP is not enabled for this server. Enable it in Server Settings." },
      { status: 400 },
    );
  }

  let files: { name: string; data: Buffer }[];
  try {
    files = await downloadPluginFiles(server);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read plugins over SFTP" },
      { status: 502 },
    );
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "No .cs plugins found in the server's plugin directory." },
      { status: 400 },
    );
  }

  const zip = createZip(files);
  const safeName = server.name.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "") || "server";
  const filename = `myrcon-plugins-${safeName}.zip`;

  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zip.length),
    },
  });
}
