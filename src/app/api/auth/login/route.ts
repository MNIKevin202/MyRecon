import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachSessionCookie, createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validators";

const windowMinutes = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES ?? 15);
const maxAttempts = Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? 8);

function requestIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login payload" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const ip = requestIp(request);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const failedAttempts = await prisma.loginAttempt.count({
    where: { email: email.toLowerCase(), ip, success: false, createdAt: { gte: since } },
  });

  if (failedAttempts >= maxAttempts) {
    return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;

  await prisma.loginAttempt.create({
    data: { email: email.toLowerCase(), ip, success: ok },
  });

  if (!user || !ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  attachSessionCookie(response, session);
  return response;
}
