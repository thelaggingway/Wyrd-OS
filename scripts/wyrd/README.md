# Wyrd-OS demo and test scripts

Scripts for testing a running Wyrd-OS server through its app API. They run on your machine (or an orb) with Bun,
not on the server. How they fit into deploying and testing is in [docs/wyrd-os/RUNBOOK.md](../../docs/wyrd-os/RUNBOOK.md).

## Settings

Every script reads these from the environment. Nothing secret is stored in this folder.

| Variable | What |
|---|---|
| `WYRD_URL` | The server's address, such as `https://3000-<machine>.instabox.tech` |
| `WYRD_EMAIL` | An owner or admin of the workspace (the demo's is `owner@wyrdwerk.test`) |
| `WYRD_PASSWORD` | That account's password (for the demo, the Amp secret `WYRD_OS_OWNER_PASSWORD`) |
| `WYRD_ORG` | Optional: the workspace's name; the account's first workspace otherwise |

A paused server must be woken first (InstaBox API or CLI); see the runbook.

## Scripts

| Script | What it does |
|---|---|
| `smoke.ts` | Quick check after a deploy: sign-in, agents, routines, templates, web app, runner download. |
| `post-day.ts <day.json>` | Posts a day of sample messages to the workspace's channels, found by name. |
| `run-routine.ts "<name>"` | Runs a routine now and waits for it to end, printing its status and summary. `--watch-only` waits without starting one; `--wait-minutes N` (default 20). |
| `wiki-dump.ts <out.md>` | Copies every wiki page into one Markdown file: Index, Open questions, daily logs, then the rest. |
| `set-timezone.ts [zone]` | Sets the workspace's time zone (default `Asia/Kolkata`) and moves the Indian SME routines to their usual local times. |

## Sample days (`days/`)

Each is a list of `{ "channel", "body" }`, for the Indian SME template's #general, #sales, #billing and
#schedule. They test what the Librarian should get right: decisions and their reversals, corrections, dates
that don't match their weekday, invoice amounts that disagree with a file, and hearsay ("as discussed…",
"I heard…") that must go to Open questions as unconfirmed.

- `2026-11-25-first-day.json`: a decision, a quote and its correction, a payment, a delivery, hearsay.
- `2026-11-26-reversals-and-corrections.json`: a cancelled decision, a moved and then corrected delivery, a new customer, two hearsay lines.
- `2026-11-27-busy-day.json`: holidays, a bonus, new quotes and enquiries, a payment method corrected, a rate rise, two hearsay lines.

## A Librarian test

```sh
bun scripts/wyrd/post-day.ts scripts/wyrd/days/2026-11-27-busy-day.json
bun scripts/wyrd/run-routine.ts "Nightly wiki update"
bun scripts/wyrd/wiki-dump.ts wiki.md
```

Then read `wiki.md` against the checks in the runbook. Each sample day is meant to be posted once per
workspace: posting the same day twice gives the Librarian duplicates to sort out.
