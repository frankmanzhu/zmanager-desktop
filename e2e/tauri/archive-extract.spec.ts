import assert from "node:assert/strict";
import path from "node:path";

import { closeArchiveIndex, collectAllEntries, openArchiveIndex, runJobExpectingSuccess } from "./helpers/archiveCommands.ts";
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
  tzapAllowDegraded: true,
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
 * Formats that both write and read the shared payload tree, with whether the
 * writer preserves symlinks.
 *
 * `appleArchive` is macOS-only and is added below at runtime rather than being
 * gated with a skip, so the list stays honest about what actually ran.
 */
const ROUND_TRIP_FORMATS: ReadonlyArray<{ format: string; extension: string; preservesSymlinks: boolean }> = [
  // The ZIP, 7z and TZAP v1 writers materialize a symlink as a regular file,
  // so those round trips use a source tree without one — otherwise the
  // comparison would be asserting a known, deliberate lossy conversion.
  { format: "zip", extension: "zip", preservesSymlinks: false },
  { format: "sevenZ", extension: "7z", preservesSymlinks: false },
  { format: "tzap", extension: "tzap", preservesSymlinks: false },
  { format: "tarGz", extension: "tar.gz", preservesSymlinks: true },
  { format: "tarZst", extension: "tar.zst", preservesSymlinks: true },
];

/**
 * Guards against a vacuous round trip.
 *
 * `diffTrees` reports no differences when both sides are empty, so a bug in
 * the source-tree builder or the tree reader would make every round trip pass
 * while proving nothing. Pinning the baseline makes that failure loud.
 */
function assertPayloadBaseline(tree: Map<string, { kind: string }>, withSymlink: boolean): void {
  for (const required of ["payload/README.txt", "payload/nested/file.txt", "payload/dir with spaces/file with spaces.txt", "payload/unicode/こんにちは.txt", "payload/nested/empty-dir"]) {
    assert.ok(tree.has(required), `source baseline is missing ${required}; saw ${JSON.stringify([...tree.keys()])}`);
  }
  assert.equal(tree.has("payload/nested/readme-link.txt"), withSymlink, `source baseline symlink presence should be ${withSymlink}`);
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
        formats.push({ format: "appleArchive", extension: "aar", preservesSymlinks: true });
      }

      for (const { format, extension, preservesSymlinks } of formats) {
        it(
          `creates and reads back a ${format} archive without losing the payload tree`,
          async () => {
            const temp = makeTempDir(`round-trip-${format}`);
            let failed = true;
            try {
              const source = path.join(temp.dir, "source");
              const payload = writePayloadSourceTree(source, { withSymlink: preservesSymlinks });
              const expected = readTree(source);
              // A tree comparison passes vacuously if both sides are empty, so
              // pin the baseline before relying on it.
              assertPayloadBaseline(expected, preservesSymlinks);
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

              const differences = diffTrees(expected, readTree(extractedInto));
              assert.deepEqual(differences, [], `${format} round trip lost data:\n  ${differences.join("\n  ")}`);
              failed = false;
            } finally {
              temp.cleanup(failed);
            }
          },
          ROUND_TRIP_TIMEOUT_MS,
        );
      }

      it(
        "round trips a password-protected archive",
        async () => {
          const temp = makeTempDir("round-trip-password");
          let failed = true;
          try {
            const source = path.join(temp.dir, "source");
            const payload = writePayloadSourceTree(source, { withSymlink: false });
            const expected = readTree(source);
            assertPayloadBaseline(expected, false);
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

            const differences = diffTrees(expected, readTree(extractedInto));
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
