# Wyrd-OS runbook

How Wyrd-OS is built, deployed, updated, woken and tested. It covers what is in the repository and what isn't.
Last updated 2026-11-27. Code changes, with dates and reasons, are in [MODIFICATIONS.md](../../MODIFICATIONS.md).

## What it is

Wyrd-OS is a fork of agentes.chat 0.1.8: a team chat where people and AI agents work together. It adds three
things on top:

- **The Chief of Staff**: the workspace's general assistant, called "the right hand" in the code
  (`right-hand.ts`).
- **Team templates**, such as "Indian SME" (`india-team.ts`). A template's specialist agents each have their own
  channel and read-and-report routine.
- **The Librarian** (`librarian.ts`). Each night it records the day's decisions, facts, open questions and files
  in the wiki, with a source for every line. On Sundays it tidies the wiki.

Every template agent ends with `NO_GUESSING`: it states nothing without a source, and anything it heard secondhand
goes to Open questions marked "(unconfirmed)".

Changes go straight to `main`, with no pull requests. Every push runs CI (`ci.yml`) and builds an image
(`wyrd-image.yml`).

## The image

- **Where it's published:** `ghcr.io/thelaggingway/wyrd-os`, with tags `main`, `sha-<7 chars>` and versions.
  There is no `stable` tag yet.
- **How it's built:** a two-stage `Dockerfile` of about 1.2 GB. The phone and desktop apps are left out, and the
  final stage holds only the server's production dependencies.
- **Checking a build:** `gh run list -R thelaggingway/Wyrd-OS --workflow wyrd-image --commit <sha>`.
- **Deploy by `sha-` tag**, so every server says exactly which commit it runs.

## Running a server

Wyrd-OS runs as Docker Compose ([docker-compose.yml](../../docker-compose.yml)): `postgres` plus `agentes`.
Nothing runs under systemd. PostgreSQL is the only dependency. The same image runs on any machine with Docker:
a cloud VM, a sandbox provider or a client's PC. Podman should run the same image, but it is untested.

### Settings Wyrd-OS needs in `.env`

| Setting | Value | Why |
|---|---|---|
| `AGENTES_IMAGE` | `ghcr.io/thelaggingway/wyrd-os:sha-<7>` | The release this server runs. |
| `AGENT_MAX_OUTPUT_TOKENS` | `128000`, which is now the default | The limit counts thinking as well as the answer. At 16,000, GLM-5.3 used it all on thinking and called no tool. |
| `HOST_COMPUTER_PORT` | default `3901` | The agents' computer reaches the app on its own loopback port, so a host that counts web traffic as activity can still pause an idle machine. |

Secret values go only in the server's `.env`. Never commit them.

### Model keys through InstaBox Org Secrets

On InstaBox a model key can stay out of the machine entirely. An Org Secret (scoped to its API's host) is attached
to the machine, which then sees only a placeholder (`ibsec_…`) in login shells; InstaBox's outbound proxy swaps
in the real key on HTTPS requests to that host, in any header.

- **Attach it.** A machine made before the secret keeps its old selection. `PATCH /v1/machines/{id}/secrets`
  (or `instabox secrets select`) replaces the whole list, so read it first with `GET` and send every name back.
- **The container must trust the proxy.** The app's `docker-compose.override.yml` mounts the proxy's CA and sets
  `NODE_EXTRA_CA_CERTS` (wyrd-os-1 has this). Without it, calls fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
- **Store the placeholder as the key.** In the workspace, add the provider with the placeholder as its API key
  (Settings › AI, or `POST /api/app/organizations/{org}/credentials`); the real key never reaches the app or its
  database.

wyrd-os-1 has `ZAI_API_KEY`, `DEEPSEEK_API_KEY` and `LAGGINGWAY_API_KEY` attached. The last is WyrdWerk's Bifrost
gateway, saved in the demo workspace as the custom provider "Laggingway" (`https://api.laggingway.com/v1`,
OpenAI style, not the default): 74 chat models named `Provider/model` (such as `Openkodo/glm-5.3`), with the
gateway's prices. The app takes at most US$ 10 per million tokens, so the four dearer models (Kimi K3 and
Gemini 4 Neon) are saved unpriced. The app's tool-call check passed on 71; three opencode-go contributor or free
models failed it.

### Two ways to update a server

1. **Image swap** (how wyrd-os-1 runs now). On the server:
   ```sh
   cd /opt/wyrd-os
   sudo cp .env .env.wyrdN          # rollback copy; N goes up by one each deploy
   sudo sed -i 's|^AGENTES_IMAGE=.*|AGENTES_IMAGE=ghcr.io/thelaggingway/wyrd-os:sha-<7>|' .env
   sudo docker compose pull agentes && sudo docker compose up -d agentes
   sudo docker compose ps agentes   # wait for "(healthy)"
   ```
   To roll back, copy the saved `.env.wyrdN` back to `.env` and run `docker compose up -d agentes` again.
   Migrations run when the app boots. Check the disk with `df -h /data` first, and remove old images when it gets
   full.
2. **`deploy/deploy.sh`** (tested on `wyrd-os-test`, not yet used on wyrd-os-1). It needs a git checkout plus
   `AGENTES_IMAGE=agentes:current` and `RUN_MIGRATIONS_ON_BOOT=false` in `.env`. Run it as
   `DEPLOY_IMAGE=ghcr.io/thelaggingway/wyrd-os:sha-<7> bash deploy/deploy.sh <full sha>`. It migrates, swaps the
   image, waits for it to be healthy, and rolls back by itself if it isn't healthy within 150 s. In testing, an
   update took 11 s with about 2 s of downtime, and a fresh install took under a minute. Over SSH, a key line in
   `authorized_keys` can be limited to running this script alone (see its header). This is the intended path for
   client servers.

### Backups

Upstream's backup profile is in `deploy/backup`. wyrd-os-1 instead runs a small `localbackup` service from
`docker-compose.override.yml`, which exists only on that machine. It runs a daily `pg_dump` into `/data/backups`
and keeps 7 days. The compose file from before it was added is saved as `.prebackup`. Neither backup copies files
off the machine.

## Sleeping and waking (InstaBox)

The demo server runs on InstaBox. Its machine pauses itself after 30 minutes idle (`autoSuspendAfterSeconds:
1800`). A paused machine runs no routine. Once it wakes, a run it missed starts straight away, so the run is late,
not lost.

- **Waking:** call the InstaBox API or CLI to resume the machine, about 10 minutes before a routine is due. For
  the nightly at 23:30 IST, wake it at 23:20 IST. Webhooks can't wake an InstaBox machine. Opening the app's URL
  may not wake a machine that was paused by hand.
- **The scheduler can live anywhere:** an Amp schedule, LuckyFox, or a cron job somewhere else. On
  2026-11-25 a one-off Amp schedule woke it and the nightly ran. **No daily wake schedule is set up yet.**
- **`.github/workflows/demo-wake.yml`** is another option. It resumes through the API and holds the machine
  awake for an hour. It does nothing until the `INSTABOX_API_KEY` and `INSTABOX_MACHINE_ID` repository secrets
  are set, and they aren't.
- **Pausing by hand:** prefer letting it auto-pause. Operator `GET /activity` reports whether the app is busy.
  `deploy/orble/` is the same idea for Orble boxes, using Orble's own API.

## Servers in use

| Name | Where | What it is |
|---|---|---|
| wyrd-os-1 | InstaBox `m_agq7g2s4b4hbytvmifjqdlfvwq`, app at `https://3000-agq7g2s4b4hbytvmifjqdlfvwq.instabox.tech`, compose in `/opt/wyrd-os` (needs sudo) | The demo. Workspace "WyrdWerk Demo" on Asia/Kolkata, with the Indian SME team and the Librarian on GLM-5.3 (Z.ai), model "Automático". Change how it is deployed only after agreeing it first. |
| wyrd-os-test | InstaBox `m_agrbhjjunqnyuvp7gaj5hgew5m`, checkout in `/data/wyrd-os` | A scratch machine for `deploy.sh` and rollback tests, with an empty database. It can be deleted. |

The demo's owner signs in as `owner@wyrdwerk.test`. The password is in the Amp secret `WYRD_OS_OWNER_PASSWORD`.

## Routines and cost

- **Effort:** routine runs on "Automático" think at low effort (`forRoutine` in `auto-model.ts`); the judge
  still picks the model tier. For GLM-5.3, Z.ai takes only `low`, `high` and `max`, and the adapter sends
  "medium" as `high`.
- **Measured cost of a heavy nightly** (about 10 messages of updates, corrections and hearsay): about US$ 1.09 at
  high effort, and about US$ 0.41 in about 3½ minutes at low effort.
- **Cut-off replies:** a reply cut off at `max_tokens` before any tool call is retried at most twice, with a nudge
  to act one step at a time (`CUT_OFF_NUDGE` in `executor.ts`).

## Testing the Librarian

1. Post a day of sample messages to the demo's channels (#general, #sales, #billing, #schedule). Include
   decisions, a reversal, corrections, a date that doesn't match its weekday, and hearsay ("as discussed…",
   "I heard…").
2. Run the routine now: `POST /api/app/organizations/{org}/routines/{id}/run`, signed in as the owner.
3. Follow it in the database:
   ```sh
   cd /opt/wyrd-os
   cat <<'EOF' | sudo docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'
   select rr.status, ar.turns, now() - ar.created_at from routine_runs rr
   join agent_runs ar on ar.id = rr.agent_run_id order by rr.created_at desc limit 1;
   EOF
   ```
   The useful tables are `routine_runs` (`status`, `summary`), `agent_run_steps` (`kind` `model_call` holds
   `stopReason`, `outputTokens` and `costNanoUsd`) and `wiki_pages`.
4. Check the results:
   - a `Log <date>` page exists;
   - hearsay appears only in Open questions, marked "(unconfirmed)", with the searches the Librarian ran;
   - replaced facts are marked "superseded", not deleted;
   - nothing is stated without a source.

The scripts for these steps are in [scripts/wyrd/](../../scripts/wyrd/README.md): `post-day.ts` with the sample
days in `days/`, `run-routine.ts`, `wiki-dump.ts`, `set-timezone.ts` and `smoke.ts` (a check after a deploy). They
take the server and account from `WYRD_URL`, `WYRD_EMAIL` and `WYRD_PASSWORD`.

## Still open

- A daily wake schedule for wyrd-os-1.
- A `stable` image tag and a per-server auto-update timer. Both are planned but not built.
- Per-model output ceilings. `AGENT_MAX_OUTPUT_TOKENS` is one number for every model, and a model whose API allows
  less output may refuse the request.
- Podman is untested.
- Backups don't copy anything off the machine.
- Orble's isolation between projects is untested. The demo stays on InstaBox.
