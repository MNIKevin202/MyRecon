import { SettingsClient } from "@/components/settings-client";
import { getAiSettings } from "@/server/settings/ai";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ai = await getAiSettings();
  return <SettingsClient initialAi={ai} />;
}
