import { describe, expect, it } from "vitest";
import { decodeJwtOrgId } from "@/lib/jwt";

// When the host hands the app a session token, the org id in the JWT becomes
// the (locked) library sync scope. This verifies we read that claim.

// The sample token from the plan — payload carries orgId "1".
const SAMPLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWE5ZGMyYi0xZDBmLTQ2MzctOGE2Ny0wM2VhNzFmMGYyY2YiLCJlbWFpbCI6Im5hZGFtc2FsdWphQGdtYWlsLmNvbSIsIm9yZ0lkIjoiMSIsImF1dGhvcml0eSI6ImFkbWluIiwiaWF0IjoxNzg0MDAyMjM4LCJleHAiOjE3ODQ0MzQyMzh9._qjOuNwhf5io8RAMXOC8Af8zN0KIJVduWNJa3Bt6ALw";

describe("decodeJwtOrgId", () => {
  it("reads orgId from the sample JWT", () => {
    expect(decodeJwtOrgId(SAMPLE)).toBe("1");
  });

  it("returns null for null / malformed tokens", () => {
    expect(decodeJwtOrgId(null)).toBeNull();
    expect(decodeJwtOrgId("")).toBeNull();
    expect(decodeJwtOrgId("not-a-jwt")).toBeNull();
    expect(decodeJwtOrgId("a.b")).toBeNull(); // payload "b" isn't valid base64 JSON
  });

  it("coerces a numeric org claim to a string", () => {
    // { "orgId": 42 }
    const header = "eyJhbGciOiJIUzI1NiJ9";
    const payload = Buffer.from(JSON.stringify({ orgId: 42 })).toString(
      "base64url",
    );
    expect(decodeJwtOrgId(`${header}.${payload}.sig`)).toBe("42");
  });
});
