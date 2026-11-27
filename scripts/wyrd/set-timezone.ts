// Wyrd-OS (MODIFICATIONS.md): sets a workspace's time zone (default Asia/Kolkata) and moves the Indian SME
// template's routines to their usual local times in it. Routines not listed below are left as they are.
//   bun scripts/wyrd/set-timezone.ts [Asia/Kolkata]
import { connect } from "./api";

const zone = process.argv[2] ?? "Asia/Kolkata";
const TIMES: Record<string, string> = {
  "List who asked for a quote and got no answer": "every day at 17:00",
  "Confirm tomorrow's appointments": "every day at 18:00",
  "The team's week": "every friday at 17:00",
  "List who is late on payment": "every monday at 08:00",
  "Nightly wiki update": "every day at 23:30",
  "Weekly wiki tidy": "every sunday at 22:00",
};
const { call, org } = await connect();
await call("PATCH", `${org}/settings`, { timezone: zone });
// The account's own zone follows the workspace's.
await call("PATCH", `${org}/me`, { timezone: null });
const { routines } = await call<{ routines: { id: string; name: string }[] }>("GET", `${org}/routines`);
for (const r of routines) {
  const phrase = TIMES[r.name];
  if (!phrase) {
    console.log(`left as it is: ${r.name}`);
    continue;
  }
  const out = await call<{ routine?: { nextRunAt?: string }; nextRunAt?: string }>("PATCH", `${org}/routines/${r.id}`, {
    trigger: { type: "schedule", phrase, timezone: zone },
  });
  console.log(`${r.name}: next ${(out.routine ?? out).nextRunAt ?? "?"}`);
}
