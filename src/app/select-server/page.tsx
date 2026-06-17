import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { ServerPicker } from "@/components/server-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Select Server" };

export default async function SelectServerPage() {
  const [user, servers] = await Promise.all([
    getSessionUser(),
    prisma.serverProfile.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        host: true,
        gamePort: true,
        rconPort: true,
        rconType: true,
        isDefault: true,
      },
    }),
  ]);

  if (servers.length === 0) redirect("/setup");
  if (!user) redirect("/login");

  return <ServerPicker servers={servers} />;
}
