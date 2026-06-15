export function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallbackMessage =
      typeof data.error === "string"
        ? data.error
        : `Request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ""})`;
    throw Object.assign(new Error(fallbackMessage), { details: data.details, status: response.status });
  }

  return data as T;
}
