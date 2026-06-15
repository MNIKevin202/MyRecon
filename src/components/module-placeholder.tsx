import { Panel } from "@/components/ui";

export function ModulePlaceholder({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Panel key={item}>
            <h2 className="text-base font-semibold text-white">{item}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Architecture placeholder reserved for this module without hardcoded server values.</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
