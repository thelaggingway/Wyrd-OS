// Wyrd-OS (MODIFICATIONS.md): a quick check of a running server after a deploy: sign-in, the workspace's agents
// and routines, the team templates, the web app and the computer runner's download.
//   bun scripts/wyrd/smoke.ts
import { connect } from "./api";

const { base, call, org, workspace } = await connect();
console.log(`signed in, workspace "${workspace.name}"`);
const { agents } = await call<{ agents: { handle: string }[] }>("GET", `${org}/agents`);
console.log(`agents: ${agents.map((a) => `@${a.handle}`).join(" ")}`);
const { routines } = await call<{ routines?: unknown[] }>("GET", `${org}/routines`);
console.log(`routines: ${routines?.length ?? 0}`);
console.log(
  `team templates: ${JSON.stringify(await call("GET", `${org}/team-templates`)).length > 100 ? "ok" : "missing"}`,
);
const page = await fetch(`${base}/`);
console.log(`web app: ${page.status} ${(await page.text()).includes("<div id") ? "ok" : "unexpected page"}`);
const runner = await fetch(`${base}/runner/agentes-runner.mjs`, { method: "HEAD" });
console.log(`runner download: ${runner.status}`);
