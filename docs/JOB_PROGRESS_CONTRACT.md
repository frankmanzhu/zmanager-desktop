# Job progress contract

The desktop job DTO supports generic byte progress and phase-native progress.
TZAP creation uses the phase-native path because its file-backed writer may
read the same source payload during planning and final emission.

## TZAP create phases

| Phase | Progress range | Meaning |
| --- | ---: | --- |
| `planningPayload` | 0-40% | Read and compress sources to determine layout |
| `planningMetadata` | 40-42% | Build index and metadata plans |
| `emittingPayload` | 42-94% | Read, compress, protect, and write final payload blocks |
| `emittingMetadata` | 94-99% | Write indexes, recovery metadata, footers, and trailers |
| `committingOutput` | 99% | Publish temporary archive outputs at their final paths |

The weights are an initial estimator calibrated from TZAP's `WriterTimings`.
They are presentation policy, not archive semantics, and can be tuned from
measured workloads without changing the Rust event contract.

Single-pass and ordered-parallel writers do not emit planning phases. For those
jobs, `emittingPayload` spans 0-94% rather than starting at 42%.

`phaseStarted` selects the active phase. `phaseBytesProcessed` is cumulative
within that phase only. The progress bar must remain below 100% while the job
status is running; only `completed` produces 100%.

Generic `bytesProcessed` remains available for file counts, speed, and archive
backends without phase reporting. For TZAP create it advances during final
payload emission rather than the planning pass.
