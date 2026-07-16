// Minimal, verification-free JWT reader. The host owns identity — we only read
// a claim (the org id) to scope the library. Pure and dependency-free so it
// stays testable without loading the browser-only SDK.

// Read the org id from the JWT payload (base64url middle segment). Returns null
// if the token is absent or has no org claim.
export function decodeJwtOrgId(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const payload = JSON.parse(atob(b64 + pad)) as Record<string, unknown>;
    const org =
      payload.orgId ?? payload.org_id ?? payload.organizationId ?? payload.oid;
    if (typeof org === "string" && org.trim()) return org.trim();
    if (typeof org === "number") return String(org);
    return null;
  } catch {
    return null;
  }
}
