# ADR-0010: Embed non-system macOS codec libraries

- Status: Accepted
- Date: 2026-07-16

## Context

The pinned core's bundled libarchive is static, but its macOS build resolves
Homebrew `liblzma` and `liblz4` dynamically. Both old native packages omitted
those libraries and crashed on a clean machine. Static Swift host and metadata
FFI linkage does not remove their transitive native load commands.

## Decision

The Release Bundle copies every non-system Mach-O dependency into
`Contents/Frameworks`, changes its install ID to `@rpath/<name>`, rewrites all
consumers, adds `@executable_path/../Frameworks` where needed, and signs nested
libraries before executables and the app. Extensions link the Rust metadata ABI
statically but resolve any selected native codec dependency from their signed
containing bundle using an explicit loader rpath. The release gate recursively
rejects `/opt/homebrew`, `/usr/local`, build-tree paths, missing dependencies,
wrong architectures, or unsigned nested code.

## Consequences

Codec licenses and notices become release inputs. Updating Homebrew on the build
host cannot silently change a published bundle because checksums, versions, and
linkage are recorded. A future fully static codec build may supersede this ADR
after both architecture matrices pass.

## Verification

Recursive `otool`, signature, architecture, clean-machine launch, and installed
extension-host loading checks run before publication. Phase 4 proved the model
with embedded `liblzma.5.dylib` and `liblz4.1.dylib` on a clean VM.
