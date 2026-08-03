import { describe, expect, it } from "vitest";
import { hasCompletedOnboarding } from "./onboarding.js";

describe("hasCompletedOnboarding", () => {
  it("requires setup for a newly created Google user", () => {
    expect(
      hasCompletedOnboarding({
        email: "new-google@example.com",
        onboarding_completed: false
      })
    ).toBe(false);
  });

  it("skips setup after the server marks onboarding complete", () => {
    expect(
      hasCompletedOnboarding({
        email: "returning-google@example.com",
        onboarding_completed: true
      })
    ).toBe(true);
  });

  it("does not trust missing or legacy local-only state", () => {
    expect(hasCompletedOnboarding({ email: "legacy@example.com" })).toBe(false);
    expect(hasCompletedOnboarding(null)).toBe(false);
  });
});
