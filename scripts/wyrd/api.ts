// Wyrd-OS (MODIFICATIONS.md): a small client for a Wyrd-OS server's app API, used by the demo scripts here.
// It signs in with a cookie session as the app's web client does (Origin = the server's address).
// Settings come from the environment, never from this file:
//   WYRD_URL       the server's address, such as https://wyrd.example.com
//   WYRD_EMAIL     an owner or admin of the workspace
//   WYRD_PASSWORD  that account's password
//   WYRD_ORG       the workspace's name (default: the account's first workspace)

export interface Workspace {
  id: string;
  name: string;
}

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} (see scripts/wyrd/README.md)`);
  return value;
}

export function client(base: string) {
  let cookie = "";
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(base + path, {
      method,
      headers: { Origin: base, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length > 0) {
      const pairs = new Map(
        cookie
          .split("; ")
          .filter(Boolean)
          .map((kv) => [kv.split("=")[0], kv]),
      );
      for (const c of set) {
        const kv = c.split(";")[0] ?? "";
        pairs.set(kv.split("=")[0], kv);
      }
      cookie = [...pairs.values()].join("; ");
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 400)}`);
    return (text ? JSON.parse(text) : null) as T;
  }
  return { call };
}

/** Signs in from the environment; `org` is the workspace's API prefix (`/api/app/organizations/{id}`). */
export async function connect() {
  const base = need("WYRD_URL").replace(/\/$/, "");
  const c = client(base);
  await c.call("POST", "/api/auth/sign-in/email", { email: need("WYRD_EMAIL"), password: need("WYRD_PASSWORD") });
  const me = await c.call<{ organizations: ({ organization?: Workspace } & Workspace)[] }>("GET", "/api/app/me");
  const workspaces = me.organizations.map((o) => o.organization ?? o);
  const wanted = process.env.WYRD_ORG;
  const workspace = wanted ? workspaces.find((w) => w.name === wanted) : workspaces[0];
  if (!workspace) throw new Error(wanted ? `No workspace named "${wanted}"` : "This account has no workspace");
  return { base, call: c.call, workspace, org: `/api/app/organizations/${workspace.id}` };
}
