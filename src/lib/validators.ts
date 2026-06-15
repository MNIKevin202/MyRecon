import { z } from "zod";

export const rconTypes = ["LEGACY", "EXPERIMENTAL", "WEBRCON"] as const;

export const serverProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  host: z.string().trim().min(2).max(255),
  gamePort: z.coerce.number().int().min(1).max(65535),
  rconPort: z.coerce.number().int().min(1).max(65535),
  rconPassword: z.string().trim().min(1).max(512),
  rconType: z.enum(rconTypes).default("WEBRCON"),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const setupSchema = serverProfileSchema.extend({
  ownerName: z.string().trim().min(2).max(80),
  ownerEmail: z.string().trim().email().max(255),
  ownerPassword: z.string().min(10).max(256),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(256),
});

export const commandSchema = z.object({
  command: z.string().trim().min(1).max(2000),
});

export const sftpSettingsSchema = z.object({
  sftpEnabled: z.coerce.boolean().default(false),
  sftpHost: z.string().trim().max(255).optional().nullable(),
  sftpPort: z.coerce.number().int().min(1).max(65535).default(22),
  sftpUsername: z.string().trim().max(255).optional().nullable(),
  sftpPassword: z.string().max(4096).optional().nullable(),
  sftpPrivateKey: z.string().max(20000).optional().nullable(),
  sftpRootPath: z.string().trim().max(1000).optional().nullable(),
  sftpDefaultPluginPath: z.string().trim().max(1000).optional().nullable(),
  sftpDefaultConfigPath: z.string().trim().max(1000).optional().nullable(),
  sftpAllowOutsideRoot: z.coerce.boolean().default(false),
});

export const sftpPathSchema = z.object({
  path: z.string().trim().max(2000).optional().default(""),
});

export const sftpReadWriteSchema = z.object({
  path: z.string().trim().min(1).max(2000),
  content: z.string().max(2 * 1024 * 1024).optional(),
});

export const sftpMkdirSchema = z.object({
  path: z.string().trim().min(1).max(2000),
});

export const sftpRenameSchema = z.object({
  oldPath: z.string().trim().min(1).max(2000),
  newPath: z.string().trim().min(1).max(2000),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  serverId: z.string().optional().nullable(),
});

export const savedCommandSchema = z.object({
  label: z.string().trim().min(1).max(120),
  command: z.string().trim().min(1).max(2000),
  categoryId: z.string().optional().nullable(),
  dangerous: z.coerce.boolean().default(false),
  requiresConfirm: z.coerce.boolean().default(false),
});

export const runCommandSchema = z.object({
  serverId: z.string().min(1),
  command: z.string().trim().min(1).max(2000),
  label: z.string().trim().max(120).optional().nullable(),
  savedCommandId: z.string().optional().nullable(),
});
