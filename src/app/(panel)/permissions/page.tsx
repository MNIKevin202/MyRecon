import { ModulePlaceholder } from "@/components/module-placeholder";

export default function PermissionsPage() {
  return (
    <ModulePlaceholder
      title="Permissions"
      description="Permission management is prepared for searchable users, groups, presets, and bulk assignments."
      items={["Search users", "Search groups", "Grant / revoke", "Permission presets"]}
    />
  );
}
