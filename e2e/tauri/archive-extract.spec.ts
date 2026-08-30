import assert from "node:assert/strict";
import path from "node:path";

import { closeArchiveIndex, collectAllEntries, openArchiveIndex, runJobExpectingSuccess } from "./helpers/archiveCommands.ts";
import type { DiskEntry } from "./helpers/archiveFixtures.ts";
import {
  diffTrees,
  fixturePath,
  hasFixtureCorpus,
  makeTempDir,
  missingCorpusReason,
  readTree,
  writePayloadSourceTree,
} from "./helpers/archiveFixtures.ts";

/**
 * Extracting and creating real archives through the running application.
 *
 * Where archive-open.spec.ts proves the app can read an archive's listing,
 * this proves the bytes actually land on disk correctly — the thing a user is
 * ultimately doing.
 */

const EXTRACT_TIMEOUT_MS = 120_000;
const ROUND_TRIP_TIMEOUT_MS = 180_000;

/** Defaults for the parts of StartExtractRequest these tests do not vary. */
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

/** Defaults for the parts of StartCreateRequest these tests do not vary. */
const CREATE_DEFAULTS = {
  cleanSource: false,
  replaceExisting: true,
  preserveMetadata: true,
} as const;

/**
 * What a create format does with a symlink in the source tree, with
 * `followSymlinks` left unset (the request default).
 *
 * `"preserved"` writes it back as a symlink. `"dropped"` omits the entry
 * entirely — silent data loss from a user's point of view, so it is asserted
 * explicitly rather than avoided.
 *
 * Every round trip puts a real symlink in its source tree and adjusts the
 * expectation to match. Omitting the symlink from the source instead — the
 * easier option — would mean a writer that changed its handling, in either
 * direction, would go unnoticed.
 */
type SymlinkHandling = "preserved" | "dropped";

/**
 * Formats that both write and read the shared payload tree, and what each does
 * with the symlink.
 *
 * These values record measured behaviour, not intent. Notably the committed
 * `basic.7z` and `basic.tzap` fixtures carry the link as a regular *file*,
 * because the CLI that generated them followed it; the application's create
 * path drops it instead. Deliberately covering `followSymlinks: true` belongs
 * with the rest of the create-option matrix.
 *
 * `appleArchive` is macOS-only and is added below at runtime rather than being
 * gated with a skip, so the list stays honest about what actually ran.
 */
type RoundTripFormat = {
  format: string;
  extension: string;
  symlinks: SymlinkHandling;
  /**
   * Set when the format is known to round trip the symlink incorrectly. The
   * link is then excluded from this test's comparison and asserted by its own
   * pending test below, so the defect stays visible in the report instead of
   * being quietly encoded as expected behaviour.
   */
  symlinkTargetDefect?: string;
};

const ROUND_TRIP_FORMATS: ReadonlyArray<RoundTripFormat> = [
  {
    format: "zip",
    extension: "zip",
    symlinks: "preserved",
    symlinkTargetDefect:
      "the ZIP writer stores a relative symlink target with its leading '../' stripped " +
      "('../README.txt' is written as 'README.txt'), so extraction produces a broken link. " +
      "Reproducible outside this app: zmanager-cli create --preserve-symlinks.",
  },
  { format: "sevenZ", extension: "7z", symlinks: "dropped" },
  { format: "tzap", extension: "tzap", symlinks: "dropped" },
  { format: "tarGz", extension: "tar.gz", symlinks: "preserved" },
  { format: "tarZst", extension: "tar.zst", symlinks: "preserved" },
];

/**
 * Guards against a vacuous round trip.
 *
 * `diffTrees` reports no differences when both sides are empty, so a bug in
 * the source-tree builder or the tree reader would make every round trip pass
 * while proving nothing. Pinning the baseline makes that failure loud.
 */
function assertPayloadBaseline(tree: Map<string, DiskEntry>): void {
  for (const required of [
    "payload/README.txt",
    "payload/nested/file.txt",
    "payload/dir with spaces/file with spaces.txt",
    "payload/unicode/こんにちは.txt",
    "payload/nested/empty-dir",
    "payload/nested/readme-link.txt",
  ]) {
    assert.ok(tree.has(required), `source baseline is missing ${required}; saw ${JSON.stringify([...tree.keys()])}`);
  }
  assert.equal(tree.get("payload/nested/readme-link.txt")?.kind, "symlink", "source baseline should contain a real symlink");
}

/** Adjusts an expected tree for a writer that omits symlinks entirely. */
function withSymlinksDropped(tree: Map<string, DiskEntry>): Map<string, DiskEntry> {
  const adjusted = new Map(tree);
  let removed = 0;
  for (const [entryPath, entry] of tree) {
    if (entry.kind === "symlink") {
      adjusted.delete(entryPath);
      removed += 1;
    }
  }
  assert.ok(removed > 0, "expected the source tree to contain a symlink to drop");
  return adjusted;
}

/** Removes symlink entries from both sides of a comparison. */
function withoutSymlinks(tree: Map<string, DiskEntry>): Map<string, DiskEntry> {
  const adjusted = new Map(tree);
  for (const [entryPath, entry] of tree) {
    if (entry.kind === "symlink") {
      adjusted.delete(entryPath);
    }
  }
  return adjusted;
}

/** Builds the expected extracted tree for a format's symlink handling. */
function expectedTreeFor(sourceTree: Map<string, DiskEntry>, format: Pick<RoundTripFormat, "symlinks" | "symlinkTargetDefect">): Map<string, DiskEntry> {
  if (format.symlinks === "dropped") {
    return withSymlinksDropped(sourceTree);
  }
  // The link is asserted by the format's own pending defect test instead.
  return format.symlinkTargetDefect ? withoutSymlinks(sourceTree) : sourceTree;
}

/**
 * Compares an extracted tree against expectations, excluding the symlink from
 * both sides when the format has a known symlink defect. Excluding it from the
 * expectation alone would simply move the failure to "unexpected entry".
 */
function diffRoundTrip(expected: Map<string, DiskEntry>, extracted: Map<string, DiskEntry>, format: Pick<RoundTripFormat, "symlinkTargetDefect">): string[] {
  return diffTrees(expected, format.symlinkTargetDefect ? withoutSymlinks(extracted) : extracted);
}

if (!hasFixtureCorpus()) {
  describe("Archive extraction and creation in the native shell", () => {
    it("requires the sibling fixture corpus", () => {
      pending(missingCorpusReason());
    });
  });
} else {
  describe("Archive extraction and creation in the native shell", () => {
    it(
      "extracts a fixture archive and writes the whole payload tree to disk",
      async () => {
        const temp = makeTempDir("extract-tar-gz");
        let failed = true;
        try {
          await runJobExpectingSuccess("start_extract", {
            ...EXTRACT_DEFAULTS,
            archivePath: fixturePath("basic.tar.gz"),
            destinationPath: temp.dir,
          });

          const extracted = readTree(temp.dir);
          const expected = new Map(
            [
              { path: "payload", kind: "directory" as const },
              { path: "payload/README.txt", kind: "file" as const, contents: "ZManager fixture payload\n" },
              { path: "payload/dir with spaces", kind: "directory" as const },
              { path: "payload/dir with spaces/file with spaces.txt", kind: "file" as const, contents: "spaces in path\n" },
              { path: "payload/nested", kind: "directory" as const },
              { path: "payload/nested/empty-dir", kind: "directory" as const },
              { path: "payload/nested/file.txt", kind: "file" as const, contents: "nested fixture file\n" },
              { path: "payload/nested/readme-link.txt", kind: "symlink" as const, target: "../README.txt" },
              { path: "payload/unicode", kind: "directory" as const },
              { path: "payload/unicode/こんにちは.txt", kind: "file" as const, contents: "unicode path fixture\n" },
            ].map((entry) => [entry.path, entry]),
          );

          const differences = diffTrees(expected, extracted);
          assert.deepEqual(differences, [], `extracted tree differs:\n  ${differences.join("\n  ")}`);
          failed = false;
        } finally {
          temp.cleanup(failed);
        }
      },
      EXTRACT_TIMEOUT_MS,
    );

    it(
      "extracts only the selected entries when given an entry subset",
      async () => {
        const temp = makeTempDir("extract-subset");
        let failed = true;
        try {
          await runJobExpectingSuccess("start_extract", {
            ...EXTRACT_DEFAULTS,
            archivePath: fixturePath("basic.tar.gz"),
            destinationPath: temp.dir,
            entryPaths: ["payload/README.txt", "payload/unicode/こんにちは.txt"],
          });

          const extracted = readTree(temp.dir);
          const files = [...extracted.values()].filter((entry) => entry.kind === "file").map((entry) => entry.path);
          assert.deepEqual(
            files.sort(),
            ["payload/README.txt", "payload/unicode/こんにちは.txt"],
            `partial extract wrote the wrong files: ${JSON.stringify([...extracted.keys()])}`,
          );
          failed = false;
        } finally {
          temp.cleanup(failed);
        }
      },
      EXTRACT_TIMEOUT_MS,
    );

    it(
      "drops the leading directory when stripComponents is set",
      async () => {
        const temp = makeTempDir("extract-strip");
        let failed = true;
        try {
          await runJobExpectingSuccess("start_extract", {
            ...EXTRACT_DEFAULTS,
            archivePath: fixturePath("basic.tar.gz"),
            destinationPath: temp.dir,
            stripComponents: 1,
          });

          const extracted = readTree(temp.dir);
          assert.ok(extracted.has("README.txt"), `stripComponents:1 should hoist payload/ contents to the root, saw ${JSON.stringify([...extracted.keys()])}`);
          assert.ok(!extracted.has("payload"), "stripComponents:1 should not leave the payload/ prefix");
          failed = false;
        } finally {
          temp.cleanup(failed);
        }
      },
      EXTRACT_TIMEOUT_MS,
    );

    it(
      "extracts an encrypted archive with the correct password",
      async () => {
        const temp = makeTempDir("extract-encrypted");
        let failed = true;
        try {
          await runJobExpectingSuccess("start_extract", {
            ...EXTRACT_DEFAULTS,
            archivePath: fixturePath("rar5-passworded-multipart.part1.rar"),
            destinationPath: temp.dir,
            password: "zmanager-rar-fixture-password",
          });

          const extracted = readTree(temp.dir);
          const files = [...extracted.values()].filter((entry) => entry.kind === "file");
          assert.ok(files.length > 0, "an encrypted multi-volume archive should extract its files");
          failed = false;
        } finally {
          temp.cleanup(failed);
        }
      },
      EXTRACT_TIMEOUT_MS,
    );

    describe("round trips", () => {
      const formats = [...ROUND_TRIP_FORMATS];
      if (process.platform === "darwin") {
        formats.push({ format: "appleArchive", extension: "aar", symlinks: "preserved" });
      }

      for (const roundTrip of formats) {
        const { format, extension } = roundTrip;
        it(
          `creates and reads back a ${format} archive without losing the payload tree`,
          async () => {
            const temp = makeTempDir(`round-trip-${format}`);
            let failed = true;
            try {
              const source = path.join(temp.dir, "source");
              const payload = writePayloadSourceTree(source);
              const sourceTree = readTree(source);
              // A tree comparison passes vacuously if both sides are empty, so
              // pin the baseline before relying on it.
              assertPayloadBaseline(sourceTree);
              const expected = expectedTreeFor(sourceTree, roundTrip);
              const destination = path.join(temp.dir, `archive.${extension}`);

              await runJobExpectingSuccess("start_create", {
                ...CREATE_DEFAULTS,
                sources: [payload],
                destinationPath: destination,
                format,
              });

              // Reading the archive back proves it is a real archive of the
              // right format, not merely a file that was written.
              const { sessionId, snapshot } = await openArchiveIndex(destination);
              try {
                assert.equal(snapshot.latestFailure, null, `created ${format} archive failed to open: ${snapshot.latestFailure?.message ?? ""}`);
                const listed = await collectAllEntries(sessionId);
                assert.ok(listed.has("payload/README.txt"), `created ${format} archive should list its members, saw ${JSON.stringify([...listed.keys()])}`);
              } finally {
                await closeArchiveIndex(sessionId);
              }

              const extractedInto = path.join(temp.dir, "extracted");
              await runJobExpectingSuccess("start_extract", {
                ...EXTRACT_DEFAULTS,
                archivePath: destination,
                destinationPath: extractedInto,
              });

              const differences = diffRoundTrip(expected, readTree(extractedInto), roundTrip);
              assert.deepEqual(differences, [], `${format} round trip lost data:\n  ${differences.join("\n  ")}`);
              failed = false;
            } finally {
              temp.cleanup(failed);
            }
          },
          ROUND_TRIP_TIMEOUT_MS,
        );

        if (roundTrip.symlinkTargetDefect) {
          it(`preserves relative symlink targets through a ${format} round trip`, () => {
            pending(roundTrip.symlinkTargetDefect as string);
          });
        }
      }

      it(
        "round trips a password-protected archive",
        async () => {
          const temp = makeTempDir("round-trip-password");
          let failed = true;
          try {
            const source = path.join(temp.dir, "source");
            const payload = writePayloadSourceTree(source);
            const sourceTree = readTree(source);
            assertPayloadBaseline(sourceTree);
            // Uses the same ZIP handling as the plain zip round trip above,
            // including its known symlink-target defect.
            const zipFormat = ROUND_TRIP_FORMATS.find((candidate) => candidate.format === "zip") as RoundTripFormat;
            const expected = expectedTreeFor(sourceTree, zipFormat);
            const destination = path.join(temp.dir, "secret.zip");
            const password = "round-trip-password";

            await runJobExpectingSuccess("start_create", {
              ...CREATE_DEFAULTS,
              sources: [payload],
              destinationPath: destination,
              format: "zip",
              password,
            });

            const extractedInto = path.join(temp.dir, "extracted");
            await runJobExpectingSuccess("start_extract", {
              ...EXTRACT_DEFAULTS,
              archivePath: destination,
              destinationPath: extractedInto,
              password,
            });

            const differences = diffRoundTrip(expected, readTree(extractedInto), zipFormat);
            assert.deepEqual(differences, [], `encrypted round trip lost data:\n  ${differences.join("\n  ")}`);
            failed = false;
          } finally {
            temp.cleanup(failed);
          }
        },
        ROUND_TRIP_TIMEOUT_MS,
      );
    });
  });
}
