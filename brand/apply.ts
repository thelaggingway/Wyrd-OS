/**
 * Applies this fork's branding to the upstream agentes.chat tree. The Dockerfile runs it before the build, so the
 * repository stays close to upstream and merging a new upstream release rarely conflicts.
 *
 *   bun brand/apply.ts
 *
 * It reads brand/brand.json, rewrites the files listed below in place, and adds a "Modified by" header to each.
 * Every edit asserts that it matched: when an upstream release moves something, the build stops here instead of
 * shipping half-branded. The license attribution ("Based on agentes.chat by AGENTESCHAT, LLC") is never touched.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const brand = JSON.parse(readFileSync(join(import.meta.dir, "brand.json"), "utf8")) as {
  name: string;
  modifiedBy: string;
  modifiedSince: string;
  sourceUrl: string;
  locales: string[];
};
const notice = `Modified by ${brand.modifiedBy} since ${brand.modifiedSince} (brand/apply.ts): ${brand.name} branding.`;

function edit(rel: string, fn: (text: string) => string, comment: "ts" | "html") {
  const path = join(root, rel);
  const before = readFileSync(path, "utf8");
  if (before.includes(notice)) return; // already applied
  let after = fn(before);
  if (after === before) throw new Error(`brand: nothing changed in ${rel}`);
  after = comment === "ts" ? `// ${notice}\n${after}` : after.replace("<!doctype html>", `<!doctype html>\n<!-- ${notice} -->`);
  writeFileSync(path, after);
  console.log(`brand: ${rel}`);
}

function must(text: string, find: string | RegExp, replace: string, what: string): string {
  const out = text.replace(find, replace);
  if (out === text) throw new Error(`brand: ${what} not found`);
  return out;
}

// 1. Languages: only the ones in brand.json can be picked or are picked for people.
edit(
  "packages/i18n/src/locale.ts",
  (t) => {
    let off = 0;
    const out = t.replace(/\{[^{}]*?code: "([^"]+)"[^{}]*?\}/gs, (entry, code: string) => {
      if (brand.locales.includes(code) || !entry.includes("ready: true")) return entry;
      off++;
      return entry.replace("ready: true", "ready: false");
    });
    if (off === 0) throw new Error("brand: no language turned off");
    return out;
  },
  "ts",
);

// 2. English strings: the product name, outside the license attribution, URLs, and upstream's own hosted service.
const KEEP = [/AGENTESCHAT/, /<site>agentes\.chat<\/site>/];
const PROTECT: [RegExp, string][] = [
  [/agentes\.chat Cloud/g, "\u0000CLOUD\u0000"],
  [/Powered by agentes\.chat/g, "\u0000POWERED\u0000"],
];
function rebrandString(s: string): string {
  if (KEEP.some((re) => re.test(s))) return s;
  for (const [re, token] of PROTECT) s = s.replace(re, token);
  s = s
    .replace(/(?<![\w./@-])agentes\.chat(?![\w/-])/g, brand.name)
    .replace(/(?<![\w./@-])agentes(?![\w./@-])/g, brand.name);
  // "an agentes.chat plan" → "a Wyrd-OS plan" when the name doesn't start with a vowel sound.
  if (!/^[aeiou]/i.test(brand.name)) s = s.replace(new RegExp(`\\b([Aa])n (?=${brand.name})`, "g"), "$1 ");
  return s.replace(/\u0000CLOUD\u0000/g, "agentes.chat Cloud").replace(/\u0000POWERED\u0000/g, "Powered by agentes.chat");
}
edit(
  "packages/i18n/src/en.ts",
  (t) => {
    t = must(
      t,
      'copyright: "Copyright © 2026 AGENTESCHAT, LLC and contributors"',
      `copyright: "Copyright © 2026 AGENTESCHAT, LLC and contributors. ${brand.name} is a modified version, changed by ${brand.modifiedBy} since ${brand.modifiedSince}; its source is linked above."`,
      "the About copyright line",
    );
    // Only string literals on lines that are a property value or a lone continuation string, never keys or code.
    return t
      .split("\n")
      .map((line) =>
        /^\s*(?:[\w$]+|"[^"]+")\s*:\s*["`]|^\s*["`]/.test(line)
          ? line.replace(/"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, (lit) => lit[0] + rebrandString(lit.slice(1, -1)) + lit[0])
          : line,
      )
      .join("\n");
  },
  "ts",
);

// 3. The page itself: title, home-screen name and share card (upstream's card image is their artwork).
edit(
  "apps/web/index.html",
  (t) => {
    t = t.replace(/^.*(og:image|twitter:image).*\n/gm, "");
    t = t.replace(/(<title>|content=")([^"<]*)/g, (_, open: string, body: string) => open + rebrandString(body));
    if (!t.includes(`<title>${brand.name}`)) throw new Error("brand: the title not found");
    return t;
  },
  "html",
);

// 4. The logo: the wordmark and the mark (upstream's agent symbol is their trademark).
edit(
  "packages/ui/src/components/Logo.tsx",
  (t) => {
    t = must(t, 'const TLD = ".chat";', 'const TLD = "";', "the logo's .chat");
    t = must(t, 'aria-label={expanded ? "agentes.chat" : "agentes"}', `aria-label=${JSON.stringify(brand.name)}`, "the logo's label");
    t = must(t, /<span>agentes<\/span>/, `<span>${brand.name}</span>`, "the wordmark");
    t = must(t, /<span aria-hidden="true">agentes<\/span>/, `<span aria-hidden="true">${brand.name}</span>`, "the mono wordmark");
    // Replace the whole LogoMark function with brand/logo-mark.tsx's, keeping its props.
    const start = t.indexOf("export function LogoMark(");
    if (start < 0) throw new Error("brand: LogoMark not found");
    let i = t.indexOf("{", t.indexOf(")", t.indexOf("}: {", start)));
    let depth = 0;
    for (; i < t.length; i++) {
      if (t[i] === "{") depth++;
      else if (t[i] === "}" && --depth === 0) break;
    }
    const mark = readFileSync(join(import.meta.dir, "logo-mark.tsx"), "utf8").split("// --- LogoMark ---\n")[1].replace("__INITIAL__", brand.name[0].toUpperCase());
    return t.slice(0, start) + mark.trim() + t.slice(i + 1);
  },
  "ts",
);

// 5. The server's name for itself in passkeys and authenticator apps.
edit("apps/server/src/auth.ts", (t) => must(t, 'appName: "agentes.chat"', `appName: ${JSON.stringify(brand.name)}`, "auth appName"), "ts");

// 6. Icons and email pictures: brand/assets mirrors apps/web/public (make them with brand/make-assets.sh).
const assets = join(import.meta.dir, "assets");
if (!existsSync(assets)) throw new Error("brand: brand/assets is missing; run brand/make-assets.sh");
cpSync(assets, join(root, "apps/web/public"), { recursive: true });
console.log("brand: icons copied");
