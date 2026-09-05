import type { ShareRecordSnapshot } from "../api/types";

export function shareFixture(patch: Partial<ShareRecordSnapshot> = {}): ShareRecordSnapshot {
  return { shareId: "share-1", clientRequestId: "request-1", enqueueSequence: "1", mode: "directShare", sourcePaths: ["/tmp/fixture.txt"], senderAlias: "Sender", compressionJobId: null, artifactPath: "/tmp/fixture.txt", receiver: null, receiverGeneration: "0", sendId: null, compressionState: "notRequired", compressionProgress: null, transferState: "notStarted", sharingIntent: "pending", lifecycle: "active", attempt: 0, bytesSent: 0, totalBytes: null, deliveryUncertain: false, createdAt: "0", updatedAt: "0", lastError: null, ...patch };
}
