import { ModulePlaceholder } from "@/components/module-placeholder";

export default function MonitoringPage() {
  return (
    <ModulePlaceholder
      title="Monitoring"
      description="Metrics storage supports hourly, daily, and weekly server history views."
      items={["CPU usage", "RAM usage", "Network activity", "FPS and player history"]}
    />
  );
}
