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
  message?: string;
  isMac?: boolean;
};

const initialState: UpdateState = { status: "idle", version: "", percent: 0 };

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState>(initialState);

  useEffect(() => {
    const api = window.myrcon;
    if (!api) {
      return;
    }

    const unsubscribers = [
      api.onUpdateAvailable(({ version }) => {
        setState({ status: "available", version, percent: 0 });
      }),
      api.onUpdateDownloadProgress(({ percent }) => {
        setState((current) => ({ ...current, status: "downloading", percent }));
      }),
      api.onUpdateDownloaded(({ version }) => {
        setState({ status: "downloaded", version, percent: 100, isMac: navigator.userAgent.includes("Macintosh") });
      }),
      api.onUpdateError((message) => {
        setState({ status: "error", version: "", percent: 0, message });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  if (state.status === "idle" || state.status === "error") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-white/10 bg-[#10141d] p-4 shadow-2xl shadow-black/40">
      {state.status === "available" && (
        <>
          <p className="text-sm font-semibold text-slate-100">Update available</p>
          <p className="mt-1 text-xs text-slate-400">Version {state.version} is ready to download.</p>
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
            <Button
              onClick={() => {
                window.myrcon?.installUpdate();
                setState((current) => ({ ...current, status: "downloading", percent: 0 }));
              }}
            >
              Install update
            </Button>
          </div>
        </>
      )}

      {state.status === "downloading" && (
        <>
          <p className="text-sm font-semibold text-slate-100">Downloading update {state.version}</p>
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
          <p className="text-sm font-semibold text-slate-100">Update {state.version} ready</p>
          <p className="mt-1 text-xs text-slate-400">
            {state.isMac
              ? "Download and install the new DMG from GitHub."
              : "The app will restart and update automatically."}
          </p>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => window.myrcon?.quitAndInstall()}>
              {state.isMac ? "Open GitHub Releases" : "Restart & Update"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
