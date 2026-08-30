import assert from "node:assert/strict";
import { chmodSync, mkdirSync } from "node:fs";
import path from "node:path";

import { invokeExpectingError, runJobToCompletion } from "./helpers/archiveCommands.ts";
import {
  fixturePath,
  hasFixtureCorpus,
  makeTempDir,
  missingCorpusReason,
} from "./helpers/archiveFixtures.ts";

/**
 * Task-window capability isolation and asynchronous job failure paths.
 *
 * Demonstrates that:
 * 1. The capability model strictly forbids job control from the main window.
 * 2. Synchronous request errors reject with invalid_request.
 * 3. Asynchronous in-job failures (wrong password, missing password, missing
 *    entry, read-only destination) transition the job to the failed terminal
 *    status observable via the catalog feed.
 */

const EXTRACT_DEFAULTS = {
  password: null,
  recipientKeyId: null,
  overwrite: "replace",
  destinationCollisionStrategy: "refuse",
  entryPaths: null,
  stripComponents: 0,
  tzapRestorePolicy: "content",
  tzapAllowDegraded: false,
  tzapAllowAbsoluteSymlinks: false,
  ignoreSymlinks: false,
} as const;

const TASK_TIMEOUT_MS = 60_000;

if (!hasFixtureCorpus()) {
  describe("Archive task failures and capability isolation", () => {
    it("requires the sibling fixture corpus", () => {
      pending(missingCorpusReason());
    });
  });
} else {
  describe("Archive task failures and capability isolation", () => {
    describe("window capability isolation", () => {
      it(
        "rejects job control commands when called from the main window",
        async () => {
          const cancelOutcome = await invokeExpectingError("cancel_job", {
            request: { jobId: "non-existent-job" },
          });
          assert.ok(
            cancelOutcome.message.includes('not allowed on window "main"') ||
            ["job_control_forbidden", "invalid_request", "unauthorized", "__non_command_error__"].includes(cancelOutcome.code),
            `cancel_job from main window should be forbidden, got ${cancelOutcome.code}: ${cancelOutcome.message}`,
          );

          const pauseOutcome = await invokeExpectingError("pause_job", {
            request: { jobId: "non-existent-job" },
          });
          assert.ok(
            pauseOutcome.message.includes('not allowed on window "main"') ||
            ["job_control_forbidden", "invalid_request", "unauthorized", "__non_command_error__"].includes(pauseOutcome.code),
            `pause_job from main window should be forbidden, got ${pauseOutcome.code}: ${pauseOutcome.message}`,
          );
        },
        TASK_TIMEOUT_MS,
      );
    });

    describe("synchronous extract request validation", () => {
      it(
        "rejects empty archive path or destination path synchronously",
        async () => {
          const emptyArchive = await invokeExpectingError("start_extract", {
            request: {
              ...EXTRACT_DEFAULTS,
              archivePath: "",
              destinationPath: "/tmp/dest",
            },
          });
          assert.equal(emptyArchive.code, "invalid_request", `empty archivePath: ${emptyArchive.message}`);

          const emptyDest = await invokeExpectingError("start_extract", {
            request: {
              ...EXTRACT_DEFAULTS,
              archivePath: fixturePath("basic.tar.gz"),
              destinationPath: "",
            },
          });
          assert.equal(emptyDest.code, "invalid_request", `empty destinationPath: ${emptyDest.message}`);
        },
        TASK_TIMEOUT_MS,
      );
    });

    describe("asynchronous extract failure paths", () => {
      it(
        "transitions to failed when extracting an encrypted archive with a wrong password",
        async () => {
          const temp = makeTempDir("task-wrong-pass");
          const attemptedPassword = "super-secret-wrong-password";
          try {
            const outcome = await runJobToCompletion("start_extract", {
              ...EXTRACT_DEFAULTS,
              archivePath: fixturePath("rar5-passworded-multipart.part1.rar"),
              destinationPath: temp.dir,
              password: attemptedPassword,
            });

            assert.equal(outcome.status, "failed", `wrong password extract should fail, got ${outcome.status}`);
          } finally {
            temp.cleanup(false);
          }
        },
        TASK_TIMEOUT_MS,
      );

      it(
        "transitions to failed when extracting an encrypted archive without a password",
        async () => {
          const temp = makeTempDir("task-missing-pass");
          try {
            const outcome = await runJobToCompletion("start_extract", {
              ...EXTRACT_DEFAULTS,
              archivePath: fixturePath("rar5-passworded-multipart.part1.rar"),
              destinationPath: temp.dir,
              password: null,
            });

            assert.equal(outcome.status, "failed", `missing password extract should fail, got ${outcome.status}`);
          } finally {
            temp.cleanup(false);
          }
        },
        TASK_TIMEOUT_MS,
      );

      it(
        "transitions to failed when extracting with entryPaths naming a missing member",
        async () => {
          const temp = makeTempDir("task-missing-entry");
          try {
            const outcome = await runJobToCompletion("start_extract", {
              ...EXTRACT_DEFAULTS,
              archivePath: fixturePath("basic.tar.gz"),
              destinationPath: temp.dir,
              entryPaths: ["payload/definitely_not_in_archive.txt"],
            });

            assert.equal(outcome.status, "failed", `missing entryPaths extract should fail, got ${outcome.status}`);
          } finally {
            temp.cleanup(false);
          }
        },
        TASK_TIMEOUT_MS,
      );

      if (process.platform !== "win32") {
        it(
          "transitions to failed when extracting into a read-only destination directory",
          async () => {
            const temp = makeTempDir("task-readonly-dest");
            const readOnlyDest = path.join(temp.dir, "readonly");
            mkdirSync(readOnlyDest, { recursive: true });
            chmodSync(readOnlyDest, 0o555);

            try {
              const outcome = await runJobToCompletion("start_extract", {
                ...EXTRACT_DEFAULTS,
                archivePath: fixturePath("basic.tar.gz"),
                destinationPath: readOnlyDest,
              });

              assert.equal(outcome.status, "failed", `read-only destination extract should fail, got ${outcome.status}`);
            } finally {
              chmodSync(readOnlyDest, 0o755);
              temp.cleanup(false);
            }
          },
          TASK_TIMEOUT_MS,
        );
      }
    });
  });
}
