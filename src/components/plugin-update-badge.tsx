"use client";

import { useEffect, useState } from "react";

export function PluginUpdateBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/exclusive-plugins/updates");
        if (!res.ok) return;
        const data = (await res.json()) as { count: number };
        setCount(data.count ?? 0);
      } catch { /* silent */ }
    }
    void check();
    const id = setInterval(() => void check(), 60_000);
    return () => clearInterval(id);
  }, []);

  if (count === 0) return null;
  return (
    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-none text-black">
      {count}
    </span>
  );
}
