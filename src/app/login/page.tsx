import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [servers, user] = await Promise.all([
    prisma.serverProfile.count(),
    getSessionUser(),
  ]);

  if (servers === 0) redirect("/setup");
  if (user) redirect("/dashboard");

  return <LoginForm />;
}
