import { ModulePlaceholder } from "@/components/module-placeholder";

export default function NotificationsPage() {
  return (
    <ModulePlaceholder
      title="Notifications"
      description="Notification channels are planned for Discord webhooks, email, and browser alerts."
      items={["Server offline", "Player joins", "Player bans", "High memory usage"]}
    />
  );
}
