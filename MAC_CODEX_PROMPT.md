# Codex Prompt For Building MyRcon On macOS

Paste this into Codex on the Mac after cloning the repository:

```text
I cloned https://github.com/MNIKevin202/MyRecon on this Mac and want to build the macOS DMG for MyRcon.

Please inspect the repo, follow AGENTS.md, install dependencies with npm ci if needed, and run the macOS desktop build:

npm run desktop:dmg

If the build fails, diagnose and fix only the macOS packaging issue. Do not commit secrets, .env, node_modules, .next, release output, or local database files. After the build succeeds, tell me where the .dmg file is and whether the app launches.
```

## Mac Setup

On the Mac, install these first:

- Git
- Node.js 22 or newer
- npm 10 or newer
- Xcode Command Line Tools

Useful setup commands:

```bash
xcode-select --install
git clone https://github.com/MNIKevin202/MyRecon.git
cd MyRecon
npm ci
npm run desktop:dmg
```

The DMG should be written to:

```text
release/
```

## Versioned Release Build

The GitHub repository is already set up to build release installers from tags. To make a new release later:

```bash
npm version patch
git push
git push origin --tags
```

That triggers GitHub Actions to build both:

- Windows `.exe`
- macOS `.dmg`

## Notes

- A DMG must be built on macOS. Windows cannot create the macOS DMG with Electron Builder.
- The app stores desktop data in the user's app data folder.
- Keep the generated `rcon-encryption.key` backed up after using the app with saved RCON passwords.
