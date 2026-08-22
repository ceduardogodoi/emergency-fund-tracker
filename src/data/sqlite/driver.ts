/**
 * The narrow slice of SQLite this app actually uses.
 *
 * Two drivers implement it: `expo-sqlite` on device, and `better-sqlite3` in the Node
 * test process (research D-006). Everything above this line — migrations, repositories,
 * the unit of work — is written once against this interface and therefore runs
 * unmodified under both, which is what makes the fast integration tests test the real
 * SQL rather than a mock of it.
 *
 * Async even though `better-sqlite3` is synchronous, because `expo-sqlite` is not and the
 * narrower shape has to be the one both can honestly satisfy.
 */
export interface SqliteDatabase {
  /**
   * Runs one or more statements with no parameters, for schema changes and pragmas.
   *
   * @param sql Statements separated by semicolons.
   */
  execute(sql: string): Promise<void>

  /**
   * Runs a single parameterized statement that writes.
   *
   * @param sql One statement with `?` placeholders.
   * @param params Bound positionally, in the order the placeholders appear.
   */
  run(sql: string, params?: readonly SqlValue[]): Promise<SqlRunResult>

  /**
   * Runs a query and returns every row.
   *
   * @returns Raw driver rows. Mapping to domain types happens in `mappers/`, never here.
   */
  selectAll<TRow>(sql: string, params?: readonly SqlValue[]): Promise<readonly TRow[]>

  /**
   * Runs a query and returns its first row.
   *
   * @returns The first row, or null when the query matched nothing.
   */
  selectOne<TRow>(sql: string, params?: readonly SqlValue[]): Promise<TRow | null>

  /** Releases the underlying handle. Further calls are undefined behaviour. */
  close(): Promise<void>
}

/**
 * A value SQLite can bind.
 *
 * Deliberately excludes `boolean` and `undefined`: the schema stores flags as 0 or 1
 * integers and absent values as NULL, and requiring the caller to say which keeps that
 * conversion in the mapper where it can be seen.
 */
export type SqlValue = string | number | null

/** What a write statement did. */
export interface SqlRunResult {
  /** Rows inserted, updated, or deleted. Zero is how a missing id is detected. */
  readonly changes: number
  /** Rowid of the last insert. Meaningless for updates and deletes. */
  readonly lastInsertRowId: number
}
