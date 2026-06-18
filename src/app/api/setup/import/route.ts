import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { canManage } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { decryptWithPassphrase, encryptSecret } from "@/lib/crypto";
import { attachSessionCookie, createSession, getRequestUser } from "@/lib/session";

type BackupServer = {
  name: string; host: string; gamePort: number; rconPort: number; rconType: string;
  modFramework?: string; sftpEnabled?: boolean; sftpProtocol?: string; sftpHost?: string | null;
  sftpPort?: number; sftpUsername?: string | null; sftpRootPath?: string | null;
  sftpDefaultPluginPath?: string | null; sftpDefaultConfigPath?: string | null;
  sftpAllowOutsideRoot?: boolean; notes?: string | null; isDefault?: boolean;
  rconPassword?: string | null; sftpPassword?: string | null; sftpPrivateKey?: string | null;
};

// POST /api/setup/import  body: { passphrase, backup }
// Allowed during first-run (no servers yet) without auth, or by an authed manager.
export async function POST(request: NextRequest) {
  const existingServers = await prisma.serverProfile.count();
  const existingUsers = await prisma.user.count();
  if (existingServers > 0) {
    const user = await getRequestUser(request);
    if (!user || !canManage(user.role)) {
      return NextResponse.json({ error: "Sign in as a manager to import into an existing setup." }, { status: 403 });
    }
  }

  const body = (await request.json()) as {
    passphrase?: string; backup?: string;
    ownerName?: string; ownerEmail?: string; ownerPassword?: string;
  };
  const passphrase = (body.passphrase ?? "").trim();
  if (!passphrase || !body.backup) {
    return NextResponse.json({ error: "Backup file and passphrase are required." }, { status: 400 });
  }

  // First run: no account exists yet, so the import must also create the owner.
  const needsOwner = existingUsers === 0;
  if (needsOwner) {
    const name = (body.ownerName ?? "").trim();
    const email = (body.ownerEmail ?? "").trim().toLowerCase();
    const pw = body.ownerPassword ?? "";
    if (name.length < 2 || !email.includes("@") || pw.length < 10) {
      return NextResponse.json({ error: "Enter an owner name, email, and a password of at least 10 characters." }, { status: 400 });
    }
  }

  let parsed: { version?: number; servers?: BackupServer[] };
  try {
    parsed = JSON.parse(decryptWithPassphrase(body.backup, passphrase));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not read backup." }, { status: 400 });
  }

  const servers = Array.isArray(parsed.servers) ? parsed.servers : [];
  if (servers.length === 0) {
    return NextResponse.json({ error: "Backup contains no servers." }, { status: 400 });
  }

  const hasDefault = (await prisma.serverProfile.count({ where: { isDefault: true } })) > 0;
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < servers.length; i++) {
    const s = servers[i];
    if (!s.name || !s.host) { skipped++; continue; }
    // Skip if a profile with the same name + host already exists
    const dupe = await prisma.serverProfile.findFirst({ where: { name: s.name, host: s.host } });
    if (dupe) { skipped++; continue; }

    await prisma.serverProfile.create({
      data: {
        name: s.name,
        host: s.host,
        gamePort: s.gamePort ?? 28015,
        rconPort: s.rconPort ?? 28016,
        rconType: s.rconType ?? "WEBRCON",
        encryptedRconPassword: encryptSecret(s.rconPassword ?? ""),
        modFramework: s.modFramework ?? "oxide",
        sftpEnabled: s.sftpEnabled ?? false,
        sftpProtocol: s.sftpProtocol ?? "SFTP",
        sftpHost: s.sftpHost ?? null,
        sftpPort: s.sftpPort ?? 22,
        sftpUsername: s.sftpUsername ?? null,
        sftpPasswordEncrypted: s.sftpPassword ? encryptSecret(s.sftpPassword) : null,
        sftpPrivateKeyEncrypted: s.sftpPrivateKey ? encryptSecret(s.sftpPrivateKey) : null,
        sftpRootPath: s.sftpRootPath ?? null,
        sftpDefaultPluginPath: s.sftpDefaultPluginPath ?? null,
        sftpDefaultConfigPath: s.sftpDefaultConfigPath ?? null,
        sftpAllowOutsideRoot: s.sftpAllowOutsideRoot ?? false,
        notes: s.notes ?? null,
        isDefault: !hasDefault && imported === 0,
      },
    });
    imported++;
  }

  // Create the owner account + session on first run
  if (needsOwner) {
    const user = await prisma.user.create({
      data: {
        email: (body.ownerEmail ?? "").trim().toLowerCase(),
        name: (body.ownerName ?? "").trim(),
        passwordHash: await bcrypt.hash(body.ownerPassword ?? "", 12),
        role: "OWNER",
      },
    });
    const session = await createSession(user.id);
    const res = NextResponse.json({ imported, skipped, loggedIn: true });
    attachSessionCookie(res, session);
    return res;
  }

  return NextResponse.json({ imported, skipped });
}
