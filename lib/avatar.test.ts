import { describe, expect, it } from "vitest";
import { ownAvatarUrl } from "@/lib/avatar";

describe("ownAvatarUrl", () => {
  it("returns null without a stored avatar", () => {
    expect(ownAvatarUrl(null)).toBeNull();
    expect(ownAvatarUrl(undefined)).toBeNull();
  });

  it("uses the random file name as the cache version without exposing the storage path", () => {
    const url = ownAvatarUrl("avatars/user_1/3f2a9c1e-1111-4222-8333-944455556666.webp");
    expect(url).toBe("/api/account/avatar?v=3f2a9c1e-1111-4222-8333-944455556666");
    expect(url).not.toContain("user_1");
  });
});
