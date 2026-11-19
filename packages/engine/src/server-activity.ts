import { type Database, schema, sql } from "@agenteschat/db";
import { WANTED_BUSY_MS } from "./machine-wake";

const {
  agentRuns,
  browserHandoffs,
  machineHolds,
  machineTasks,
  machines,
  mailWatches,
  organizationMembers,
  outbox,
  routines,
} = schema;

/** How far back `lastUsedAt` looks at runs and tasks, as `machineActivity` (ADR 0161). */
const ACTIVITY_WINDOW_MS = 7 * 86_400_000;

/** What keeps this server busy now, each one a reason it shouldn't be put to sleep. */
export type ServerBusyReason = "runs" | "waiting_computer" | "tasks" | "screens" | "wanted" | "jobs";

export interface ServerActivity {
  /** Work in progress or due now anywhere on this server: putting its machine to sleep would cut it off. */
  busy: boolean;
  reasons: ServerBusyReason[];
  /** The last run, task, call for a computer or member's visit, in any workspace (null: none in the window). */
  lastUsedAt: Date | null;
  /** The next routine or queued job due later: something outside has to wake the machine by then. */
  nextDueAt: Date | null;
  /** Routines that fire on incoming email: a sleeping machine reads that mail only once it is awake again. */
  mailWatches: number;
}

/**
 * Wyrd-OS (MODIFICATIONS.md): whether the machine this whole server runs on may sleep. ADR 0161's `machineActivity`
 * answers for one workspace's managed computer; this answers for the server, with the work due later too.
 */
export async function serverActivity(db: Database, now = new Date()): Promise<ServerActivity> {
  const nowAt = sql`${now.toISOString()}::timestamptz`;
  const since = sql`${new Date(now.getTime() - ACTIVITY_WINDOW_MS).toISOString()}::timestamptz`;
  const wantedSince = sql`${new Date(now.getTime() - WANTED_BUSY_MS).toISOString()}::timestamptz`;
  const at = (v: string | Date | null): Date | null => (v === null ? null : new Date(v));
  const [row] = await db
    .select({
      runs: sql<boolean>`exists (select 1 from ${agentRuns} where ${agentRuns.status} in ('queued', 'running'))`,
      waitingComputer: sql<boolean>`exists (select 1 from ${agentRuns}
        where ${agentRuns.waitingMachineId} is not null and ${agentRuns.status} = 'waiting_input')`,
      tasks: sql<boolean>`exists (select 1 from ${machineTasks} where ${machineTasks.status} in ('queued', 'running'))`,
      screens: sql<boolean>`exists (select 1 from ${machineHolds}
          where ${machineHolds.endedAt} is null and (${machineHolds.until} is null or ${machineHolds.until} > ${nowAt}))
        or exists (select 1 from ${browserHandoffs} where ${browserHandoffs.status} = 'active')`,
      wanted: sql<boolean>`exists (select 1 from ${machines} where ${machines.wantedAt} > ${wantedSince})`,
      jobs: sql<boolean>`exists (select 1 from ${outbox} where ${outbox.status} = 'processing'
        or (${outbox.status} = 'pending' and ${outbox.nextAttemptAt} <= ${nowAt}))`,
      runAt: sql<Date | null>`(select max(coalesce(${agentRuns.finishedAt}, ${agentRuns.updatedAt})) from ${agentRuns}
        where ${agentRuns.createdAt} > ${since})`.mapWith(at),
      taskAt: sql<Date | null>`(select max(${machineTasks.updatedAt}) from ${machineTasks}
        where ${machineTasks.createdAt} > ${since})`.mapWith(at),
      wantedAt: sql<Date | null>`(select max(${machines.wantedAt}) from ${machines})`.mapWith(at),
      seenAt: sql<Date | null>`(select max(${organizationMembers.lastSeenAt}) from ${organizationMembers})`.mapWith(at),
      routineDue: sql<Date | null>`(select min(${routines.nextRunAt}) from ${routines}
        where ${routines.active} and ${routines.deletedAt} is null and ${routines.nextRunAt} > ${nowAt})`.mapWith(at),
      jobDue: sql<Date | null>`(select min(${outbox.nextAttemptAt}) from ${outbox}
        where ${outbox.status} = 'pending' and ${outbox.nextAttemptAt} > ${nowAt})`.mapWith(at),
      // Drizzle writes columns here without their table, so no join: `id` would be ambiguous.
      mailWatches: sql<number>`(select count(*) from ${mailWatches} where ${mailWatches.routineId} in
        (select ${routines.id} from ${routines} where ${routines.active} and ${routines.deletedAt} is null))`.mapWith(
        Number,
      ),
    })
    .from(sql`(select 1) as one`);
  if (!row) throw new Error("serverActivity: no row");
  const flags: [ServerBusyReason, boolean][] = [
    ["runs", row.runs],
    ["waiting_computer", row.waitingComputer],
    ["tasks", row.tasks],
    ["screens", row.screens],
    ["wanted", row.wanted],
    ["jobs", row.jobs],
  ];
  const reasons = flags.filter(([, on]) => on).map(([reason]) => reason);
  const latest = (dates: (Date | null)[], pick: (a: number, b: number) => number) => {
    const times = dates.filter((d): d is Date => d !== null).map((d) => d.getTime());
    return times.length ? new Date(times.reduce((a, b) => pick(a, b))) : null;
  };
  return {
    busy: reasons.length > 0,
    reasons,
    lastUsedAt: latest([row.runAt, row.taskAt, row.wantedAt, row.seenAt], Math.max),
    nextDueAt: latest([row.routineDue, row.jobDue], Math.min),
    mailWatches: row.mailWatches,
  };
}
