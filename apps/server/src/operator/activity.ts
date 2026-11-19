import { serverActivity } from "@agenteschat/engine";
import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { errorResponse } from "../http/errors";
import { json } from "../routes/app/context";
import type { OperatorDeps } from "./app";

const ServerActivity = z
  .object({
    busy: z.boolean().openapi({ description: "Work in progress or due now: don't put the machine to sleep." }),
    reasons: z.array(z.enum(["runs", "waiting_computer", "tasks", "screens", "wanted", "jobs"])).openapi({
      description:
        "Why it is busy: a run queued or running (`runs`), a run waiting for a computer (`waiting_computer`), a task running on one (`tasks`), a person in control of an agent's screen or browser (`screens`), something asking for a computer in the last 2 minutes (`wanted`), a queued job processing or due (`jobs`).",
    }),
    lastUsedAt: z.iso.datetime({ offset: true }).nullable().openapi({
      description: "The last run, task, call for a computer or member's visit in the last 7 days; null: none.",
    }),
    nextDueAt: z.iso.datetime({ offset: true }).nullable().openapi({
      description: "The next routine or queued job due later: wake the machine before then. Null: nothing scheduled.",
    }),
    mailWatches: z.number().int().openapi({
      description:
        "Routines fired by incoming email. Mail that arrives while the machine sleeps is read once it wakes.",
    }),
  })
  .openapi("OperatorServerActivity");

/** Wyrd-OS (MODIFICATIONS.md): whether the machine this server runs on may sleep, for a watchdog beside it. */
export function registerOperatorActivity(api: OpenAPIHono, { db }: OperatorDeps) {
  api.openapi(
    createRoute({
      method: "get",
      path: "/activity",
      tags: ["Operator"],
      summary: "Whether this server's machine may sleep, and when something must wake it",
      description:
        "Across every workspace. Sleep only while `busy` is false, `lastUsedAt` is old enough and `nextDueAt` is far enough; have something outside wake the machine before `nextDueAt`.",
      responses: { 200: json(ServerActivity), 401: errorResponse("Missing or wrong token") },
    }),
    async (c) => {
      const a = await serverActivity(db);
      return c.json(
        {
          busy: a.busy,
          reasons: a.reasons,
          lastUsedAt: a.lastUsedAt?.toISOString() ?? null,
          nextDueAt: a.nextDueAt?.toISOString() ?? null,
          mailWatches: a.mailWatches,
        },
        200,
      );
    },
  );
}
