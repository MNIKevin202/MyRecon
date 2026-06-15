import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup-wizard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [users, servers] = await Promise.all([
    prisma.user.count(),
    prisma.serverProfile.count(),
  ]);

  if (users > 0 && servers > 0) {
    redirect("/dashboard");
  }

  return <SetupWizard />;
}
