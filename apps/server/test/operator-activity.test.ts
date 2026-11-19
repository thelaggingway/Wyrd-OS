import { afterAll, beforeAll, expect, test } from "bun:test";
import { eq, schema } from "@agenteschat/db";
import { createLogger } from "../src/logger";
import { createOperatorApp } from "../src/operator/app";
import { browser, createTestServer, seedOrg, signUp, type TestServer } from "./harness";

const TOKEN = "operator-activity-token-".padEnd(48, "x");

let t: TestServer;
let get: (authorization?: string | null) => Promise<Response>;
let acme: { orgId: string; agentId: string; channelId: string };

type Activity = {
  busy: boolean;
  reasons: string[];
  lastUsedAt: string | null;
  nextDueAt: string | null;
  mailWatches: number;
};
const activity = async () => (await (await get()).json()) as Activity;

beforeAll(async () => {
  t = await createTestServer({ env: { OPERATOR_API_TOKEN: TOKEN, ALLOW_SIGNUP: "true" } });
  const app = createOperatorApp(
    {
      db: t.db,
      config: t.config,
      version: "test",
      log: createLogger("error"),
      pubsub: t.adapters.pubsub,
      blobs: t.adapters.platformBlobs,
      hub: t.engine.machineHub,
    },
    TOKEN,
  );
  get = async (authorization = `Bearer ${TOKEN}`) =>
    app.request("/api/operator/v1/activity", { headers: authorization === null ? {} : { authorization } });
  const owner = browser(t);
  await signUp(owner, "owner@acme.test");
  acme = await seedOrg(owner);
  // Whatever signing up queued is not this test's work.
  await t.db.update(schema.outbox).set({ status: "done" });
  await t.db.update(schema.agentRuns).set({ status: "done" });
  await t.db.update(schema.routines).set({ active: false });
});

afterAll(async () => {
  await t?.close();
});

test("the server's activity: only with the token, busy with work, and when something must wake it", async () => {
  expect((await get(null)).status).toBe(401);
  expect((await get("Bearer wrong")).status).toBe(401);

  // Nothing running or due: it may sleep.
  expect(await activity()).toMatchObject({ busy: false, reasons: [], nextDueAt: null, mailWatches: 0 });

  // A run queued: busy until it ends.
  const [run] = await t.db
    .insert(schema.agentRuns)
    .values({
      orgId: acme.orgId,
      agentId: acme.agentId,
      channelId: acme.channelId,
      threadRootId: crypto.randomUUID(),
      triggerMessageId: crypto.randomUUID(),
      trigger: "mention",
      hop: 1,
    })
    .returning({ id: schema.agentRuns.id });
  expect(await activity()).toMatchObject({ busy: true, reasons: ["runs"] });
  await t.db
    .update(schema.agentRuns)
    .set({ status: "done" })
    .where(eq(schema.agentRuns.id, run?.id ?? ""));
  // Ended, it is the last use.
  const ended = await activity();
  expect(ended.busy).toBe(false);
  expect(Date.now() - Date.parse(ended.lastUsedAt ?? "")).toBeLessThan(60_000);

  // A job due later and a routine due sooner: not busy, and the routine is the next thing to wake for.
  const soon = new Date(Date.now() + 60 * 60_000);
  const later = new Date(Date.now() + 3 * 60 * 60_000);
  const [job] = await t.db
    .insert(schema.outbox)
    .values({ orgId: acme.orgId, kind: "test.later", payload: {}, nextAttemptAt: later })
    .returning({ id: schema.outbox.id });
  expect(await activity()).toMatchObject({ busy: false, nextDueAt: later.toISOString() });
  await t.db.insert(schema.routines).values({
    orgId: acme.orgId,
    agentId: acme.agentId,
    name: "Morning brief",
    prompt: "Brief me",
    target: { type: "dm" },
    triggerType: "schedule",
    nextRunAt: soon,
  });
  expect(await activity()).toMatchObject({ busy: false, nextDueAt: soon.toISOString() });

  // That job picked up, or due now: busy.
  const job_ = eq(schema.outbox.id, job?.id ?? "");
  await t.db.update(schema.outbox).set({ status: "processing" }).where(job_);
  expect(await activity()).toMatchObject({ busy: true, reasons: ["jobs"], nextDueAt: soon.toISOString() });
  await t.db
    .update(schema.outbox)
    .set({ status: "pending", nextAttemptAt: new Date(Date.now() - 1000) })
    .where(job_);
  expect(await activity()).toMatchObject({ busy: true, reasons: ["jobs"] });
  await t.db.update(schema.outbox).set({ status: "done" }).where(job_);
  expect((await activity()).busy).toBe(false);
});
