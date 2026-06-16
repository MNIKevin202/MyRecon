"use client";

import { Button } from "@/components/ui";
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

type Status = "idle" | "available" | "downloading" | "downloaded" | "error";

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
        setState({ status: "available", version, percent: 0 });
      }),
      api.onUpdateDownloadProgress(({ percent }) => {
        setState((current) => ({ ...current, status: "downloading", percent }));
      }),
      api.onUpdateDownloaded(({ version }) => {
        setState({ status: "downloaded", version, percent: 100 });
      }),
      api.onUpdateError(() => {
        setState(initialState);
      }),
    ];

    return () => {
      unsubscribers.forEach((fn) => fn());
    };
  }, []);

  if (state.status === "idle") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-white/10 bg-[#10141d] p-4 shadow-2xl shadow-black/40">
      {state.status === "available" && (
        <>
          <p className="text-sm font-semibold text-slate-100">Update available — v{state.version}</p>
          <p className="mt-1 text-xs text-slate-400">
            {isMac
              ? "A new version is available on GitHub."
              : "Ready to download and install."}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                window.myrcon?.skipUpdate(state.version);
                setState(initialState);
              }}
            >
              Skip
            </Button>
            {isMac ? (
              <Button onClick={() => window.myrcon?.openReleases()}>
                Open GitHub
              </Button>
            ) : (
              <Button
                onClick={() => {
                  window.myrcon?.installUpdate();
                  setState((current) => ({ ...current, status: "downloading", percent: 0 }));
                }}
              >
                Install update
              </Button>
            )}
          </div>
        </>
      )}

      {state.status === "downloading" && (
        <>
          <p className="text-sm font-semibold text-slate-100">Downloading update v{state.version}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-orange-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, state.percent)).toFixed(0)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">{Math.round(state.percent)}%</p>
        </>
      )}

      {state.status === "downloaded" && (
        <>
          <p className="text-sm font-semibold text-slate-100">Update v{state.version} ready</p>
          <p className="mt-1 text-xs text-slate-400">The app will restart and update automatically.</p>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => window.myrcon?.quitAndInstall()}>Restart & Update</Button>
          </div>
        </>
      )}
    </div>
  );
}
