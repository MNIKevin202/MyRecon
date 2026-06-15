import { ModulePlaceholder } from "@/components/module-placeholder";

export default function SchedulingPage() {
  return (
    <ModulePlaceholder
      title="Scheduling"
      description="Scheduled command execution is represented in the schema and ready for a worker process."
      items={["Automatic saves", "Restart announcements", "Server restarts", "Custom commands"]}
    />
  );
}
