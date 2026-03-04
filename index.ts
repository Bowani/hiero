/**
 * @file Scheduled transaction helpers — create, sign, and track status.
 *
 * Wraps the `@hashgraph/sdk` ScheduleCreate / ScheduleSign flows with
 * higher-level abstractions and a status-polling helper.
 */

import {
  Client,
  PrivateKey,
  ScheduleCreateTransaction,
  ScheduleSignTransaction,
  ScheduleInfoQuery,
  ScheduleInfo,
  Transaction,
  TransactionReceipt,
  TransactionId,
  Status,
} from "@hashgraph/sdk";

import {
  ScheduleId,
  AccountId,
  HieroError,
  ScheduledTransactionTimeoutError,
} from "../types/index.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Options for creating a scheduled transaction */
export interface ScheduleCreateOptions {
  /**
   * The inner transaction to schedule.
   * Must NOT be frozen or signed before passing here.
   */
  scheduledTransaction: Transaction;
  /** Human-readable memo (max 100 bytes) */
  memo?: string;
  /** Account ID that will pay for the execution; defaults to the client operator. */
  payerAccountId?: AccountId;
  /**
   * If provided, the schedule becomes admin-deletable and signable only by this key.
   * Defaults to no admin key (immutable schedule).
   */
  adminKey?: PrivateKey;
  /** Expiration time as a JS Date. Mirror Node caps this at ~62 days from creation. */
  expirationTime?: Date;
}

/** Result of a successful schedule creation */
export interface ScheduleCreateResult {
  /** The new schedule ID, e.g. "0.0.55555" */
  scheduleId: ScheduleId;
  /** The full transaction receipt */
  receipt: TransactionReceipt;
  /** Transaction ID of the ScheduleCreate itself */
  createTransactionId: TransactionId;
}

/** Result of signing a scheduled transaction */
export interface ScheduleSignResult {
  scheduleId: ScheduleId;
  receipt: TransactionReceipt;
}

/** Options for waiting until a scheduled transaction executes */
export interface WaitForExecutionOptions {
  /** Polling interval in ms (default: 3_000) */
  pollIntervalMs?: number;
  /** Maximum time to wait in ms (default: 120_000 = 2 minutes) */
  timeoutMs?: number;
  /** Called on each poll with the current status string */
  onPoll?: (status: string, scheduleId: ScheduleId) => void;
}

/** Status of a scheduled transaction */
export type ScheduledTransactionStatus =
  | "PENDING"     // waiting for signatures / execution time
  | "EXECUTED"    // inner transaction ran successfully
  | "DELETED"     // admin deleted the schedule
  | "EXPIRED"     // schedule expired before execution
  | "UNKNOWN";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toScheduledStatus(info: ScheduleInfo): ScheduledTransactionStatus {
  if (info.executed_at !== null && info.executed_at !== undefined) return "EXECUTED";
  if (info.deleted_at !== null && info.deleted_at !== undefined) return "DELETED";
  // Mirror SDK uses executedAt / deletedAt field names
  // Fall back using the raw object shape if SDK changes
  const raw = info as unknown as Record<string, unknown>;
  if (raw["executedAt"]) return "EXECUTED";
  if (raw["deletedAt"]) return "DELETED";
  return "PENDING";
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Create a scheduled transaction on-network.
 *
 * @example
 * ```ts
 * import { Client, TransferTransaction, AccountId, Hbar } from "@hashgraph/sdk";
 * import { createScheduledTransaction } from "@hiero-sdk/utils/scheduled";
 *
 * const inner = new TransferTransaction()
 *   .addHbarTransfer("0.0.12345", new Hbar(-1))
 *   .addHbarTransfer("0.0.67890", new Hbar(1));
 *
 * const result = await createScheduledTransaction(client, {
 *   scheduledTransaction: inner,
 *   memo: "Weekly payment",
 * });
 * console.log("Schedule created:", result.scheduleId);
 * ```
 */
export async function createScheduledTransaction(
  client: Client,
  options: ScheduleCreateOptions
): Promise<ScheduleCreateResult> {
  const {
    scheduledTransaction,
    memo = "",
    payerAccountId,
    adminKey,
    expirationTime,
  } = options;

  let scheduleCreate = new ScheduleCreateTransaction()
    .setScheduledTransaction(scheduledTransaction)
    .setScheduleMemo(memo);

  if (payerAccountId) {
    scheduleCreate = scheduleCreate.setPayerAccountId(payerAccountId);
  }
  if (adminKey) {
    scheduleCreate = scheduleCreate.setAdminKey(adminKey.publicKey);
  }
  if (expirationTime) {
    scheduleCreate = scheduleCreate.setExpirationTime(expirationTime);
  }

  const txResponse = await scheduleCreate.execute(client);
  const receipt = await txResponse.getReceipt(client);

  if (receipt.scheduleId === null || receipt.scheduleId === undefined) {
    throw new HieroError(
      "ScheduleCreate receipt did not include a scheduleId",
      "MISSING_SCHEDULE_ID"
    );
  }

  return {
    scheduleId: receipt.scheduleId.toString(),
    receipt,
    createTransactionId: txResponse.transactionId,
  };
}

/**
 * Add a signature to an existing scheduled transaction.
 *
 * @example
 * ```ts
 * const result = await signScheduledTransaction(client, "0.0.55555", signerKey);
 * console.log("Signed:", result.receipt.status.toString());
 * ```
 */
export async function signScheduledTransaction(
  client: Client,
  scheduleId: ScheduleId,
  signerKey: PrivateKey
): Promise<ScheduleSignResult> {
  const txResponse = await new ScheduleSignTransaction()
    .setScheduleId(scheduleId)
    .freezeWith(client)
    .sign(signerKey)
    .then((tx) => tx.execute(client));

  const receipt = await txResponse.getReceipt(client);

  return { scheduleId, receipt };
}

/**
 * Query the current status of a scheduled transaction.
 *
 * @example
 * ```ts
 * const status = await getScheduledTransactionStatus(client, "0.0.55555");
 * console.log(status); // "PENDING" | "EXECUTED" | "DELETED" | "EXPIRED"
 * ```
 */
export async function getScheduledTransactionStatus(
  client: Client,
  scheduleId: ScheduleId
): Promise<ScheduledTransactionStatus> {
  try {
    const info = await new ScheduleInfoQuery()
      .setScheduleId(scheduleId)
      .execute(client);
    return toScheduledStatus(info);
  } catch (err: unknown) {
    // SDK throws when the schedule no longer exists
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("INVALID_SCHEDULE_ID") ||
      msg.includes("SCHEDULE_DELETED") ||
      msg.includes("SCHEDULE_EXPIRED")
    ) {
      if (msg.includes("SCHEDULE_EXPIRED")) return "EXPIRED";
      if (msg.includes("SCHEDULE_DELETED")) return "DELETED";
    }
    throw err;
  }
}

/**
 * Poll until a scheduled transaction executes (or times out).
 *
 * Returns the final status (`"EXECUTED"`, `"DELETED"`, or `"EXPIRED"`).
 * Throws {@link ScheduledTransactionTimeoutError} if the timeout is reached
 * while status is still `"PENDING"`.
 *
 * @example
 * ```ts
 * const finalStatus = await waitForScheduledTransaction(client, "0.0.55555", {
 *   pollIntervalMs: 5_000,
 *   timeoutMs: 60_000,
 *   onPoll: (status, id) => console.log(`[${id}] status: ${status}`),
 * });
 * console.log("Final status:", finalStatus);
 * ```
 */
export async function waitForScheduledTransaction(
  client: Client,
  scheduleId: ScheduleId,
  options: WaitForExecutionOptions = {}
): Promise<ScheduledTransactionStatus> {
  const {
    pollIntervalMs = 3_000,
    timeoutMs = 120_000,
    onPoll,
  } = options;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await getScheduledTransactionStatus(client, scheduleId);
    onPoll?.(status, scheduleId);

    if (status !== "PENDING") {
      return status;
    }

    await sleep(pollIntervalMs);
  }

  throw new ScheduledTransactionTimeoutError(scheduleId);
}
