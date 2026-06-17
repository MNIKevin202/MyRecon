// Per-launch "active server selected" gate.
//
// The desktop app boots a fresh Next.js server process on every launch
// (electron/main.cjs requires the standalone server.js), so this module-level
// flag resets each time the app opens. That gives us a "choose your server on
// startup" prompt without persisting the choice across launches — while still
// letting the user navigate freely once they've picked one for the session.
//
// The actual active server is whichever ServerProfile has isDefault = true;
// selecting one on startup simply sets that flag (same mechanism as the
// "Default" button on the Servers page).

// Stored on globalThis rather than a module-level variable: Next.js bundles
// route handlers and page/layout code into separate chunks, so a plain module
// variable is NOT shared between the /select route handler (which sets it) and
// the panel layout (which reads it). globalThis is a single instance across all
// bundles in the same process, so the flag is shared — and still resets each
// launch since the desktop app starts a fresh process.
const KEY = "__myrcon_serverSelectedThisLaunch";

type GlobalWithFlag = typeof globalThis & { [KEY]?: boolean };

export function markServerSelected() {
  (globalThis as GlobalWithFlag)[KEY] = true;
}

export function hasSelectedServer() {
  return (globalThis as GlobalWithFlag)[KEY] === true;
}

export function resetServerSelection() {
  (globalThis as GlobalWithFlag)[KEY] = false;
}
