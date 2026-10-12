// Suite kit v7: copied from OnePortal src/lib/db.ts. Change it in the hub first, then copy it here.
import "server-only";
import sql from "mssql";
import { getConfig } from "@/lib/config";

/**
 * Database access (ARCHITECTURE.md §2, §7).
 *
 * There is one way to run SQL: a tagged template.
 *
 *     const rows = await db.query<UserRow>`SELECT id, email FROM dbo.user_accounts WHERE id = ${userId}`;
 *
 * Every ${value} becomes a typed parameter (@param1, @param2 …), never string concatenation,
 * so values cannot inject SQL. An array value expands to a parameter list for IN (...) —
 * never pass an empty array (IN () is a syntax error).
 *
 * Writes that must report what they changed use an OUTPUT clause, so the returned rows are
 * the rows affected: zero rows means "someone else got there first" or "not yours".
 */
export interface Db {
  query<Row = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
}

// Kept on globalThis so dev-server hot reloads reuse one pool instead of opening a new one per edit.
const globalForDb = globalThis as unknown as { oneportalPool?: Promise<sql.ConnectionPool> };

function getPool(): Promise<sql.ConnectionPool> {
  if (!globalForDb.oneportalPool) {
    const pool = new sql.ConnectionPool(getConfig().databaseConnectionString);
    globalForDb.oneportalPool = pool.connect().catch((error: unknown) => {
      // Let the next request try again instead of caching the failure forever.
      globalForDb.oneportalPool = undefined;
      throw error;
    });
  }
  return globalForDb.oneportalPool;
}

export const db: Db = {
  async query<Row>(strings: TemplateStringsArray, ...values: unknown[]) {
    const pool = await getPool();
    const result = await pool.request().query<Row>(strings, ...values);
    return result.recordset ?? [];
  },
};

/**
 * Runs `work` in one transaction: all of it commits, or none of it does.
 *
 * Functions that must be able to join a caller's transaction take `db: Db` as their first
 * parameter; pass them `tx`. Run statements one after another (await each one) — a
 * transaction is one connection, so Promise.all over it is not allowed.
 */
export async function withTransaction<T>(work: (tx: Db) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  const tx: Db = {
    async query<Row>(strings: TemplateStringsArray, ...values: unknown[]) {
      const result = await new sql.Request(transaction).query<Row>(strings, ...values);
      return result.recordset ?? [];
    },
  };

  try {
    const outcome = await work(tx);
    await transaction.commit();
    return outcome;
  } catch (error) {
    await transaction.rollback().catch(() => {
      // The original error is the one worth reporting; a failed rollback adds nothing.
    });
    throw error;
  }
}
