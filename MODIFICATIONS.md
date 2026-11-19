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
