import { NextRequest, NextResponse } from "next/server";
import { canManage, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptWithPassphrase } from "@/lib/crypto";

function safeDecrypt(value: string | null | undefined) {
  if (!value) return null;
  try { return decryptSecret(value); } catch { return null; }
}

// POST /api/setup/export  body: { passphrase }
// Returns a passphrase-encrypted backup of all server profiles (incl. secrets).
export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = (await request.json()) as { passphrase?: string };
  const passphrase = (body.passphrase ?? "").trim();
  if (passphrase.length < 6) {
    return NextResponse.json({ error: "Passphrase must be at least 6 characters." }, { status: 400 });
  }

  const servers = await prisma.serverProfile.findMany({ orderBy: { name: "asc" } });

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    servers: servers.map((srv) => ({
      name: srv.name,
      host: srv.host,
      gamePort: srv.gamePort,
      rconPort: srv.rconPort,
      rconType: srv.rconType,
      modFramework: srv.modFramework,
      sftpEnabled: srv.sftpEnabled,
      sftpProtocol: srv.sftpProtocol,
      sftpHost: srv.sftpHost,
      sftpPort: srv.sftpPort,
      sftpUsername: srv.sftpUsername,
      sftpRootPath: srv.sftpRootPath,
      sftpDefaultPluginPath: srv.sftpDefaultPluginPath,
      sftpDefaultConfigPath: srv.sftpDefaultConfigPath,
      sftpAllowOutsideRoot: srv.sftpAllowOutsideRoot,
      notes: srv.notes,
      isDefault: srv.isDefault,
      rconPassword: safeDecrypt(srv.encryptedRconPassword),
      sftpPassword: safeDecrypt(srv.sftpPasswordEncrypted),
      sftpPrivateKey: safeDecrypt(srv.sftpPrivateKeyEncrypted),
    })),
  };

  const encrypted = encryptWithPassphrase(JSON.stringify(backup), passphrase);
  return new NextResponse(encrypted, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="myrcon-setup.myrcon"`,
    },
  });
}
