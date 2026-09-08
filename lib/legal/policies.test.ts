import { describe, expect, it } from "vitest";
import { currentPolicyVersions, getMarketingPreference, hasCurrentRequiredPolicies } from "@/lib/legal/policies";

describe("policy state", () => {
  it("requires both current mandatory documents", () => {
    expect(hasCurrentRequiredPolicies([
      { policyType: "TERMS_OF_SERVICE", action: "ACCEPTED", documentVersion: currentPolicyVersions.terms },
    ])).toBe(false);
    expect(hasCurrentRequiredPolicies([
      { policyType: "TERMS_OF_SERVICE", action: "ACCEPTED", documentVersion: currentPolicyVersions.terms },
      { policyType: "PRIVACY_NOTICE", action: "ACKNOWLEDGED", documentVersion: currentPolicyVersions.privacy },
    ])).toBe(true);
  });

  it("does not count an outdated document version", () => {
    expect(hasCurrentRequiredPolicies([
      { policyType: "TERMS_OF_SERVICE", action: "ACCEPTED", documentVersion: "old" },
      { policyType: "PRIVACY_NOTICE", action: "ACKNOWLEDGED", documentVersion: currentPolicyVersions.privacy },
    ])).toBe(false);
  });

  it("uses the latest marketing decision", () => {
    expect(getMarketingPreference([
      { policyType: "MARKETING_COMMUNICATIONS", action: "GRANTED", documentVersion: currentPolicyVersions.marketing, occurredAt: "2026-01-01" },
      { policyType: "MARKETING_COMMUNICATIONS", action: "WITHDRAWN", documentVersion: currentPolicyVersions.marketing, occurredAt: "2026-02-01" },
    ])).toBe(false);
  });
});
