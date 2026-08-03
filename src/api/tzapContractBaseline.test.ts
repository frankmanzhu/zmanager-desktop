import { describe, expect, it } from "vitest";
import anchors from "../../fixtures/contracts/tzap-normative-wire-anchors.json";
import baseline from "../../docs/contracts/tzap-spec-baseline.json";

describe("TZAP normative contract baseline", () => {
  it("pins the reviewed source commit and contract version", () => {
    expect(baseline.sourceCommit).toBe("089536f2ef7454fe8f53f362837f4b578448669d");
    expect(baseline.clientContractVersion).toBe(anchors.contractVersion);
    expect(baseline.normativeFiles).toHaveLength(7);
  });

  it("preserves the wire anchors that prevent legacy-profile drift", () => {
    expect(anchors.nativeAuthExchange.path).toBe("/auth/session/exchange");
    expect(anchors.nativeAuthExchange.requestFields).toEqual([
      "client_id", "redirect_uri", "state", "handoff_code", "code_verifier", "required_audience",
    ]);
    expect(anchors.bulkStatus.responseField).toBe("responses");
    expect(anchors.denial.statusClass).toBe("non-2xx");
    expect(anchors.enrollment.signatureEncoding).toBe("P1363");
  });
});
