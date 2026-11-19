# Branding

Wyrd-OS is upstream agentes.chat with a branding layer applied when the image is built. The repository keeps
upstream's files as they are (apart from `Dockerfile`, `README.md` and `NOTICE`), so merging a new upstream release
rarely conflicts.

| File | What it is |
| --- | --- |
| `brand.json` | The product name, who modified it and since when, the source URL, the languages offered. |
| `apply.ts` | Rewrites the name, logo, languages and icons in the tree. `Dockerfile` runs it before the build. Each edit checks it matched, so a moved upstream string fails the build instead of shipping half-branded. |
| `logo.svg` | The logo (placeholder: a purple square with the initial). |
| `logo-mark.tsx` | The in-app mark that replaces upstream's `LogoMark`. |
| `make-assets.sh` | Regenerates `assets/` (icons, favicon, email pictures, share card) from `logo.svg`. Needs ImageMagick 7 and jq. |
| `assets/` | Generated files, copied over `apps/web/public` by `apply.ts`. |

## Rename the product

1. Change `name` in `brand.json` (and `sourceUrl` if the repository moves).
2. Replace `logo.svg` (and the mark in `logo-mark.tsx` if it isn't an initial), then `bash brand/make-assets.sh`.
3. Commit, add a row to `MODIFICATIONS.md`, and update the name in the notices at the top of `README.md` and the end of `NOTICE`.

Renaming the GitHub repository is safe: GitHub redirects the old address.

## Take a new upstream release

```sh
git fetch upstream --tags
git merge v0.1.9            # upstream tag; conflicts, if any, are in Dockerfile, README.md or NOTICE
bun brand/apply.ts && git diff --stat && git checkout -- packages apps   # dry run: fails loudly if upstream moved a string
git tag v0.1.9-wyrd.1 && git push origin main --tags                      # CI builds ghcr.io/<owner>/wyrd-os:v0.1.9-wyrd.1
```

Then add a `MODIFICATIONS.md` row naming the new upstream version.

## What must never change (license)

- The attribution "Based on agentes.chat by AGENTESCHAT, LLC (https://agentes.chat)" in `NOTICE` and the About
  screen. `apply.ts` leaves every string containing `AGENTESCHAT` untouched.
- `LICENSE`, `NOTICE`, and a working source link: set `SOURCE_URL` on every server to this repository.
- No "agentes" in our product name, domain or app listing, and none of their logos (TRADEMARKS.md).
