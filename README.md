# MyRcon

MyRcon is a self-hosted web administration panel for Rust servers. It is built with Next.js, TypeScript, Tailwind CSS, server-side API routes, WebRCON support, and SQLite for local installs.

The first milestone includes:

- First-run setup wizard
- Owner login and session management
- Encrypted RCON credential storage
- Multi-server profile management
- Dashboard status widgets
- Server-side WebRCON command execution
- Live console view with history, search, filtering, refresh, and log export
- Docker and Docker Compose packaging

## Requirements

- Node.js 22+
- npm 10+
- A Rust server with RCON enabled

## Local Installation

```bash
npm install
copy .env.example .env
npx prisma migrate dev --name init
npm run dev
```

If Prisma's migration engine is unavailable on a local Windows machine, use the bundled SQL initializer:

```bash
npm run db:init-sqlite
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to the setup wizard until an owner account and first server profile exist.

## Environment Variables

Create `.env` from `.env.example`.

```bash
DATABASE_URL="file:./dev.db"
APP_URL="http://localhost:3000"
SESSION_SECRET="replace-with-at-least-32-random-characters"
RCON_ENCRYPTION_KEY="replace-with-32-byte-base64-key"
AUTH_COOKIE_NAME="myrcon_session"
LOGIN_RATE_LIMIT_WINDOW_MINUTES="15"
LOGIN_RATE_LIMIT_MAX_ATTEMPTS="8"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.5"
```

Generate a strong encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`RCON_ENCRYPTION_KEY` protects stored RCON passwords. Keep it backed up. If it is lost, saved RCON passwords cannot be decrypted.

`OPENAI_API_KEY` is optional and can also be configured in **Settings > OpenAI Plugin Analysis** after installation. When configured, the Plugins **Manage** view can read an installed `.cs` plugin over server-side SFTP and send the source to OpenAI for code-aware suggestions. Without it, MyRcon still performs a local scan for permissions, commands, config hints, and common risk patterns. `OPENAI_MODEL` defaults to `gpt-5.5` and can be changed per installation.

## Rust Server RCON

For WebRCON, a typical Rust server launch configuration includes:

```bash
+rcon.web 1 +rcon.port 28016 +rcon.password "your-password"
```

Legacy and Experimental RCON types are represented in the schema and UI for compatibility, but this milestone implements WebRCON command execution first.

## Docker

```bash
copy .env.example .env
docker compose up --build
```

The Compose file stores SQLite data in the `myrcon-data` volume and exposes the app on port `3000`.

Run migrations in a container before first production use:

```bash
docker compose run --rm myrcon npm run db:deploy
```

For SQLite-only deployments you can also run:

```bash
docker compose run --rm myrcon npm run db:init-sqlite
```

## Configuration Guide

1. Start the app.
2. Create the owner account in the setup wizard.
3. Enter a server name, host/IP, game port, RCON port, password, and RCON type.
4. Use **Test Connection and Open Dashboard**.
5. Add more servers from **Servers**.

No server host, password, SteamID, username, or plugin name is hardcoded in the application.

## Security Model

- RCON passwords are encrypted before being stored.
- RCON passwords are never returned by API responses.
- RCON communication happens only inside server-side routes.
- Sessions use HTTP-only cookies.
- Login attempts are rate limited by email and IP window.
- API routes require authentication after setup.
- Role support is included in the schema: Owner, Admin, Moderator, Read Only.
- Plugin source is only sent to OpenAI when an OpenAI key is configured in Settings or `OPENAI_API_KEY` and an authenticated user clicks **Analyze .cs**. SFTP credentials, RCON passwords, and private keys are never sent to OpenAI.

## PostgreSQL Upgrade Path

SQLite is the default for local and small VPS installs. PostgreSQL support can be added by:

1. Changing `datasource db.provider` in `prisma/schema.prisma` from `sqlite` to `postgresql`.
2. Setting `DATABASE_URL` to a PostgreSQL connection string.
3. Creating a new migration baseline with Prisma.
4. Running `npm run db:deploy` in production.

The data-access layer already goes through Prisma, so the application code is isolated from direct SQLite APIs.

## Desktop Installers

MyRcon can be packaged as a desktop app with Windows and macOS installers. The installed app starts a private local Next.js server, stores SQLite data in the user's app data folder, and opens the admin panel in a desktop window.

Build a Windows installer from Windows:

```bash
npm run desktop:installer
```

Build a macOS DMG from macOS:

```bash
npm run desktop:dmg
```

The installer is written to:

```text
release/
```

For a faster packaging smoke test without creating the NSIS installer:

```bash
npm run desktop:pack
```

Installed desktop data is stored under the Windows user profile app data folder for MyRcon. The app automatically creates:

- `myrcon.db`
- `rcon-encryption.key`

Keep `rcon-encryption.key` backed up if you rely on saved RCON passwords. Losing it means stored RCON passwords cannot be decrypted.

## Version Releases

GitHub Actions builds versioned desktop releases when a semantic version tag is pushed.

```bash
npm version patch
git push
git push origin --tags
```

Tags like `v0.1.19` create a GitHub Release with the Windows `.exe` installer and macOS `.dmg` attached. The macOS build runs on GitHub's macOS runner because DMG packaging must run on macOS.

Packaged desktop apps automatically check GitHub Releases for updates shortly after launch. When an update is available, a notification appears in the app with **Install update** and **Skip** options. Installing downloads the update and restarts the app to apply it. Set `MYRCON_DISABLE_AUTO_UPDATE=1` before launching the app to temporarily disable update checks.

The release workflow also uploads Electron updater metadata (`latest.yml`, `latest-mac.yml`, and blockmaps). The macOS build includes a `.zip` artifact because Electron's macOS updater needs it even though users normally install from the `.dmg`.

## Roadmap

- Persistent WebSocket streaming gateway for browser console sessions
- Player moderation actions
- Carbon and Oxide plugin adapters
- Permission search and presets
- Saved command packs
- Scheduled command worker
- Metrics collectors and graphs
- Discord, email, and browser notification channels
