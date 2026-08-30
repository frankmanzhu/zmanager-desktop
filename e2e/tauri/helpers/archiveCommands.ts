import type { ExpectedEntry } from "./archiveFixtures.ts";
import { isGenerationArtifact } from "./archiveFixtures.ts";

/**
 * Typed access to the real archive commands inside the running application.
 *
 * These call the compiled Rust backend through the embedded WebDriver bridge,
 * so they exercise the real engine and real disk — they only skip the DOM. See
 * `GUI_ARCHIVE_WORKFLOW_TEST_PLAN.md` for how this tier relates to the
 * DOM-driven journeys.
 *
 * Capability note: the main window is granted the archive-index commands,
 * `start_create`, `start_extract`, `test_archive` and `subscribe_job_catalog`,
 * but NOT `subscribe_job` (see `src-tauri/capabilities/default.json`). Job
 * failure codes therefore are not observable here; index failures are, through
 * `latestFailure` on the index snapshot.
 */

export type CommandError = {
  code: string;
  message: string;
  hint: string | null;
  severity: string;
  retryable: boolean;
};

export type ArchiveIndexStatus = "indexing" | "ready" | "empty" | "failed" | "cancelled";

export type ArchiveIndexSnapshot = {
  revision: string;
  sessionId: string;
  archivePath: string;
  status: ArchiveIndexStatus;
  discoveredEntries: number;
  discoveredBytes: number | null;
  finalEntryCount: number | null;
  finalTotalBytes: number | null;
  latestFailure: CommandError | null;
  format?: string;
};

export type ArchiveEntry = {
  path: string;
  kind: "file" | "directory" | "symlink" | "hardlink" | "special";
  size: number | null;
  encrypted: boolean | null;
};

export type ArchiveChildrenPage = {
  sessionId: string;
  revision: string;
  parentPath: string;
  entries: ArchiveEntry[];
  nextCursor: string | null;
  complete: boolean;
  childCount: number;
};

/** Result of a command that may fail, so failure codes can be asserted. */
export type CommandOutcome<T> = { ok: true; value: T } | { ok: false; error: CommandError };

/**
 * Invokes a Tauri command inside the application window.
 *
 * Errors are returned rather than thrown so failure-path tests can assert on
 * the error code. The payload crosses the WebDriver bridge as JSON, so only
 * serializable arguments and results are supported.
 */
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<CommandOutcome<T>> {
  return (await browser.tauri.execute(
    async ({ core }, commandName: string, commandArgs: Record<string, unknown> | undefined) => {
      try {
        return { ok: true, value: await core.invoke(commandName, commandArgs) };
      } catch (error) {
        // Command errors arrive as the serialized CommandErrorDto; anything
        // else (a missing capability, a bridge fault) is surfaced verbatim so
        // it cannot masquerade as a command-level failure.
        if (error !== null && typeof error === "object" && "code" in error) {
          return { ok: false, error };
        }
        return { ok: false, error: { code: "__non_command_error__", message: String(error), hint: null, severity: "error", retryable: false } };
      }
    },
    command,
    args,
  )) as CommandOutcome<T>;
}

/** Invokes a command, failing the test if it returns an error. */
export async function invokeOk<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const outcome = await invoke<T>(command, args);
  if (!outcome.ok) {
    throw new Error(`${command} failed unexpectedly: ${outcome.error.code} — ${outcome.error.message}`);
  }
  return outcome.value;
}

/** Invokes a command, expecting it to fail, and returns the error. */
export async function invokeExpectingError(command: string, args?: Record<string, unknown>): Promise<CommandError> {
  const outcome = await invoke(command, args);
  if (outcome.ok) {
    throw new Error(`${command} unexpectedly succeeded: ${JSON.stringify(outcome.value)}`);
  }
  return outcome.error;
}

export async function detectArchiveFormat(archivePath: string): Promise<string> {
  const response = await invokeOk<{ format: string }>("detect_archive_format", { request: { path: archivePath } });
  return response.format;
}

/**
 * Opens an archive and waits for indexing to reach a terminal status.
 *
 * Waiting is done by re-entering `wait_archive_index` with the last seen
 * revision rather than sleeping, so the wait is driven by the backend's own
 * revision feed. The caller owns the returned session and must close it.
 */
export async function openArchiveIndex(
  archivePath: string,
  options: { password?: string; timeoutMs?: number } = {},
): Promise<{ sessionId: string; snapshot: ArchiveIndexSnapshot }> {
  const start = await invokeOk<{ sessionId: string; snapshot: ArchiveIndexSnapshot }>("start_archive_index", {
    request: { archivePath, password: options.password ?? null },
  });

  const deadline = Date.now() + (options.timeoutMs ?? 30_000);
  let snapshot = start.snapshot;
  while (snapshot.status === "indexing") {
    if (Date.now() > deadline) {
      await closeArchiveIndex(start.sessionId);
      throw new Error(`indexing ${archivePath} did not reach a terminal status within the timeout`);
    }
    snapshot = await invokeOk<ArchiveIndexSnapshot>("wait_archive_index", {
      request: { sessionId: start.sessionId, afterRevision: snapshot.revision },
    });
  }

  return { sessionId: start.sessionId, snapshot };
}

export async function closeArchiveIndex(sessionId: string): Promise<void> {
  await invokeOk("close_archive_index", { request: { sessionId } });
}

export async function getArchiveChildren(
  sessionId: string,
  parentPath: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<ArchiveChildrenPage> {
  return invokeOk<ArchiveChildrenPage>("get_archive_children", {
    request: { sessionId, parentPath, cursor: options.cursor ?? null, limit: options.limit ?? null },
  });
}

/**
 * Walks the whole index by paging through every directory, returning entries
 * keyed by path.
 *
 * Paging rather than requesting one huge page is deliberate: it exercises the
 * cursor path that the GUI itself uses to render large archives.
 */
export async function collectAllEntries(sessionId: string, pageLimit = 50): Promise<Map<string, ArchiveEntry>> {
  const collected = new Map<string, ArchiveEntry>();
  // A malformed archive can report a directory as its own descendant, so track
  // visited parents rather than trusting the listing to be acyclic.
  const visited = new Set<string>();
  const pending = [""];

  while (pending.length > 0) {
    const parentPath = pending.pop() as string;
    if (visited.has(parentPath)) {
      continue;
    }
    visited.add(parentPath);

    let cursor: string | undefined;
    do {
      const page = await getArchiveChildren(sessionId, parentPath, { cursor, limit: pageLimit });
      for (const entry of page.entries) {
        collected.set(entry.path, entry);
        if (entry.kind === "directory" && !visited.has(entry.path)) {
          pending.push(entry.path);
        }
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }

  return collected;
}

/**
 * Asserts every expected entry is present with the expected kind.
 *
 * Reports all mismatches at once rather than failing on the first, because a
 * format that mangles names usually mangles several and one-at-a-time
 * diagnosis is slow.
 */
export function assertEntriesPresent(label: string, actual: Map<string, ArchiveEntry>, expected: readonly ExpectedEntry[]): void {
  const problems: string[] = [];
  for (const { path: expectedPath, kind } of expected) {
    const entry = actual.get(expectedPath);
    if (!entry) {
      problems.push(`missing ${expectedPath}`);
    } else if (entry.kind !== kind) {
      problems.push(`${expectedPath} has kind ${entry.kind}, expected ${kind}`);
    }
  }
  if (problems.length > 0) {
    const listing = [...actual.keys()].sort().join("\n  ");
    throw new Error(`${label}: ${problems.join("; ")}\nactual entries:\n  ${listing}`);
  }
}

/**
 * Asserts the listing is exactly `expected`, ignoring known generation
 * artifacts. A subset check alone lets a format silently drop payload members.
 */
export function assertEntriesAreExactly(label: string, actual: Map<string, ArchiveEntry>, expected: readonly ExpectedEntry[]): void {
  assertEntriesPresent(label, actual, expected);

  const unexpected = [...actual.keys()]
    .filter((entryPath) => entryPath.length > 0 && !isGenerationArtifact(entryPath))
    .filter((entryPath) => !expected.some((candidate) => candidate.path === entryPath));

  if (unexpected.length > 0) {
    throw new Error(`${label}: unexpected entries ${JSON.stringify(unexpected.sort())}`);
  }
}
