import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canManage, requireUser } from "@/lib/api";
import { getAiSettings, saveAiSettings } from "@/server/settings/ai";

const schema = z.object({
  apiKey: z.string().trim().max(4096).optional().nullable(),
  model: z.string().trim().min(1).max(80).optional().nullable(),
  clearApiKey: z.coerce.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  return NextResponse.json(await getAiSettings());
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;
  if (!canManage(user.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid AI settings" }, { status: 400 });
  }

  const settings = await saveAiSettings(parsed.data);
  return NextResponse.json(settings);
}
