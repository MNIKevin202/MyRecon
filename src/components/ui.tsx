import { clsx } from "@/lib/utils";
import type React from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "h-11 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400",
        props.className,
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "h-11 w-full rounded-md border border-white/10 bg-[#10141d] px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400",
        props.className,
      )}
    />
  );
}

export function Button({
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-orange-500 text-white hover:bg-orange-400",
        variant === "secondary" && "border border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
        props.className,
      )}
    />
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20", className)}>
      {children}
    </section>
  );
}
