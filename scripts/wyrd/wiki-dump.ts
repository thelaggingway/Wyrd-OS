// Wyrd-OS (MODIFICATIONS.md): writes every wiki page of a workspace into one Markdown file, Index first, then
// Open questions, the daily logs (newest first) and the other pages by title.
//   bun scripts/wyrd/wiki-dump.ts wiki.md
import { connect } from "./api";

const out = process.argv[2];
if (!out) throw new Error("Usage: bun scripts/wyrd/wiki-dump.ts <out.md>");
type Page = { slug: string; title: string; folder?: string | null; version: number; body?: string };
const { call, org, workspace } = await connect();
const { pages } = await call<{ pages: Page[] }>("GET", `${org}/wiki/pages`);
const rank = (t: string) => (t === "Index" ? 0 : t === "Open questions" ? 1 : t.startsWith("Log ") ? 2 : 3);
pages.sort(
  (a, b) =>
    rank(a.title) - rank(b.title) ||
    (rank(a.title) === 2 ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title)),
);
let text = `# ${workspace.name} wiki\n\n${pages.length} pages, copied ${new Date().toISOString().slice(0, 16)} UTC.\n\n`;
for (const p of pages) {
  const full = await call<{ page?: Page } & Page>("GET", `${org}/wiki/pages/${p.slug}`);
  // One heading level down, so every page sits under its own title.
  const body = ((full.page ?? full).body ?? "").replace(/^(#{1,5}) /gm, "#$1 ");
  text += `---\n\n## ${p.title}\n\n*${p.folder || "Top level"} · version ${p.version}*\n\n${body.trim()}\n\n`;
}
await Bun.write(out, text);
console.log(`${pages.length} pages written to ${out}`);
