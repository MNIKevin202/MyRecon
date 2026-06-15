import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [users, servers, user] = await Promise.all([
    prisma.user.count(),
    prisma.serverProfile.count(),
    getSessionUser(),
  ]);

  if (users === 0 || servers === 0) {
    redirect("/setup");
  }

  if (!user) {
    redirect("/login");
  }

  redirect("/dashboard");
}
