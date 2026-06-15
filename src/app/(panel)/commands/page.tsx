import { ModulePlaceholder } from "@/components/module-placeholder";

export default function CommandsPage() {
  return (
    <ModulePlaceholder
      title="Commands"
      description="Saved command packs can be categorized, marked dangerous, confirmed before execution, and exported."
      items={["Categories", "Dangerous flags", "Confirmation", "Import / export packs"]}
    />
  );
}
