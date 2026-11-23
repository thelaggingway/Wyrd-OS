# Modifications

Wyrd-OS is a modified version of agentes.chat (https://github.com/agentes-chat/agentes-chat), licensed under
the GNU AGPL-3.0-only with the terms in [NOTICE](NOTICE). This file lists what WyrdWerk changed and when, as
section 5(a) of the license asks. Upstream's own history is in the Git log before the first entry below.

| Date | Based on upstream | Change |
| --- | --- | --- |
| 2026-11-19 | v0.1.8 (`6576de568`) | Added `brand/`: at image build, `brand/apply.ts` replaces the product name in the English strings (`packages/i18n/src/en.ts`), the page title and share card (`apps/web/index.html`), the logo (`packages/ui/src/components/Logo.tsx`), the name shown in authenticator apps (`apps/server/src/auth.ts`), and the icons and email pictures in `apps/web/public`. The license attribution and upstream's names for its own hosted service are left as they are. |
| 2026-11-19 | v0.1.8 | English only: `brand/apply.ts` sets every other language to `ready: false` in `packages/i18n/src/locale.ts`. The translations stay in the source. |
| 2026-11-19 | v0.1.8 | The About screen's copyright line says this is a modified version, by whom and since when; the source link there comes from `SOURCE_URL`. |
| 2026-11-19 | v0.1.8 | `Dockerfile` runs `brand/apply.ts` before the build. Added `.github/workflows/wyrd-image.yml` to build and publish the image. Notices added to `README.md` and `NOTICE`. |
| 2026-11-19 | v0.1.8 | Quiet idle tabs: `apps/web/src/lib/dormant.ts`, wired in `apps/web/src/realtime/context.tsx` and `apps/web/src/main.tsx`. After 5 minutes with no input and no agent working, a tab closes its live connection and stops polling, so the server's machine can pause; the first input reconnects it and refetches what is on screen. |
| 2026-11-19 | v0.1.8 | The agents' computer on the server reaches the app on its own loopback port: `docker-compose.yml` publishes `127.0.0.1:${HOST_COMPUTER_PORT:-3901}`, and the setup (`appOnThisMachine` in `packages/setup/src/lib.ts`) points the runner there instead of `HOST_PORT`. Documented in `SELF_HOSTING.md`. |
| 2026-11-19 | v0.1.8 | Operator `GET /activity` (`apps/server/src/operator/activity.ts`, `packages/engine/src/server-activity.ts`): whether the machine this server runs on may sleep. `busy` with its reasons (runs, a run waiting for a computer, computer tasks, a person on an agent's screen, a computer asked for in the last 2 minutes, background jobs processing or due), `lastUsedAt`, `nextDueAt` (the next routine or queued job) and `mailWatches`. Documented in `SELF_HOSTING.md`. |
| 2026-11-19 | v0.1.8 | `.github/workflows/ci.yml`: the `build` job (and so `publish`), which pushes upstream's images to `ghcr.io/agentes-chat`, runs only in `agentes-chat/agentes-chat`. This fork's image comes from `wyrd-image.yml`. |
| 2026-11-20 | v0.1.8 | Added `deploy/orble/`: a watchdog that suspends an idle Orble box through Orble's in-box API when `GET /activity` says nothing is going on, and a firewall service that lets only the watchdog's container reach that API. |
| 2026-11-23 | v0.1.8 | Agents' `search_context` takes `after`, `before` and `sort` (the index's ADR 0123 filters), and without `query` lists a window newest first (`searchWindow` in `packages/engine/src/context/tools.ts`). `search_wiki` and `read_wiki_page` show each page's dates (`packages/engine/src/wiki-tools.ts`). |
