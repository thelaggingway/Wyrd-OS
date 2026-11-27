// Wyrd-OS (MODIFICATIONS.md): posts a day of sample team messages to a workspace's channels, as the signed-in
// account, for testing the Librarian's nightly run.
//   bun scripts/wyrd/post-day.ts scripts/wyrd/days/2026-11-27-busy-day.json
// The file is a list of { "channel": "<channel name without #>", "body": "<message>" }.
import { connect } from "./api";

const file = process.argv[2];
if (!file) throw new Error("Usage: bun scripts/wyrd/post-day.ts <day.json>");
const day = (await Bun.file(file).json()) as { channel: string; body: string }[];
const { call, org } = await connect();
const listed = await call<{ channels: { id: string; name: string }[] }>("GET", `${org}/channels`);
const byName = new Map(listed.channels.map((c) => [c.name, c.id]));
for (const { channel, body } of day) {
  const id = byName.get(channel);
  if (!id) throw new Error(`No channel #${channel} in this workspace`);
  await call("POST", `${org}/channels/${id}/messages`, { body });
  console.log(`posted in #${channel}`);
}
