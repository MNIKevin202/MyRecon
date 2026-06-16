"use client";

import { useEffect, useState } from "react";

type UpdateApi = {
  onUpdateAvailable: (callback: (payload: { version: string }) => void) => () => void;
  onUpdateDownloadProgress: (callback: (payload: { percent: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (payload: { version: string }) => void) => () => void;
  onUpdateError: (callback: (message: string) => void) => () => void;
  installUpdate: () => void;
  skipUpdate: (version: string) => void;
  quitAndInstall: () => void;
  openReleases: () => void;
};

declare global {
  interface Window {
    myrcon?: UpdateApi;
  }
}

type Status = "idle" | "available" | "downloading" | "downloaded";

type UpdateState = {
  status: Status;
  version: string;
  percent: number;
};

const initialState: UpdateState = { status: "idle", version: "", percent: 0 };

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState>(initialState);
  const [isMac] = useState(() => typeof navigator !== "undefined" && navigator.userAgent.includes("Macintosh"));

  useEffect(() => {
    const api = window.myrcon;
    if (!api) return;

    const unsubscribers = [
      api.onUpdateAvailable(({ version }) => {
        // On Windows the download starts automatically, so go straight to downloading.
        // On macOS we just show a button to open GitHub.
        setState({ status: isMac ? "available" : "downloading", version, percent: 0 });
      }),
      api.onUpdateDownloadProgress(({ percent }) => {
        setState((current) => ({ ...current, status: "downloading", percent }));
      }),
      api.onUpdateDownloaded(({ version }) => {
        // Windows: main process will quitAndInstall after 3 s automatically.
        setState({ status: "downloaded", version, percent: 100 });
      }),
      api.onUpdateError(() => {
        setState(initialState);
      }),
    ];

    return () => unsubscribers.forEach((fn) => fn());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-white/10 bg-[#10141d] p-4 shadow-2xl shadow-black/40">

      {/* macOS only — show link to GitHub */}
      {state.status === "available" && (
        <>
          <p className="text-sm font-semibold text-slate-100">Update available — v{state.version}</p>
          <p className="mt-1 text-xs text-slate-400">A new version is available on GitHub.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                window.myrcon?.skipUpdate(state.version);
                setState(initialState);
              }}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]"
            >
              Skip
            </button>
            <button
              onClick={() => window.myrcon?.openReleases()}
              className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-400"
            >
              Open GitHub
            </button>
          </div>
        </>
      )}

      {/* Windows — passive progress bar, no interaction needed */}
      {state.status === "downloading" && (
        <>
          <p className="text-sm font-semibold text-slate-100">Downloading update v{state.version}</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, state.percent)).toFixed(0)}%` }}
            />
          </div>
          <p className="mt-1.5 text-right text-xs text-slate-500">{Math.round(state.percent)}%</p>
        </>
      )}

      {/* Windows — briefly shown before auto-restart */}
      {state.status === "downloaded" && (
        <>
          <p className="text-sm font-semibold text-slate-100">Update v{state.version} ready</p>
          <p className="mt-1 text-xs text-slate-400">Restarting to apply update…</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full bg-orange-500" />
          </div>
        </>
      )}

    </div>
  );
}
