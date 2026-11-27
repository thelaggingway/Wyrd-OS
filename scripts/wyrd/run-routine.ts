// Wyrd-OS (MODIFICATIONS.md): runs a routine now, by its name, and waits for the run to end.
//   bun scripts/wyrd/run-routine.ts "Nightly wiki update" [--wait-minutes 20] [--watch-only]
// --watch-only waits on the latest run without starting one. The run's steps, tokens and cost are in the
// server's database (docs/wyrd-os/RUNBOOK.md, "Testing the Librarian").
import { connect } from "./api";

const name = process.argv[2];
if (!name) throw new Error('Usage: bun scripts/wyrd/run-routine.ts "<routine name>"');
const flag = process.argv.indexOf("--wait-minutes");
const waitMs = Number(flag > 0 ? process.argv[flag + 1] : 20) * 60_000;
const { call, org } = await connect();
const { routines } = await call<{ routines: { id: string; name: string }[] }>("GET", `${org}/routines`);
const routine = routines.find((r) => r.name === name);
if (!routine) throw new Error(`No routine "${name}". There are: ${routines.map((r) => r.name).join(", ")}`);
if (!process.argv.includes("--watch-only")) await call("POST", `${org}/routines/${routine.id}/run`, {});
const started = Date.now();
type Run = { status: string; summary?: string | null };
let run: Run | undefined;
while (Date.now() - started < waitMs) {
  run = (await call<{ runs: Run[] }>("GET", `${org}/routines/${routine.id}/runs`)).runs[0];
  if (run && run.status !== "running" && run.status !== "queued" && run.status !== "started") break;
  await Bun.sleep(10_000);
}
console.log(`status: ${run?.status ?? "none"} after ${Math.round((Date.now() - started) / 1000)} s`);
if (run?.summary) console.log(run.summary);
