import { useHostContext } from "../hooks/useHostContext";
import { decodeJwtOrgId } from "./jwt";

// Organization-scoped library sync.
//
// When the Munshot host hands the app a session token, the analyst's memo
// library is scoped to their ORGANIZATION id (carried in the JWT) — everyone
// in the org shares one library, and the sync id is locked (not user-editable).
// When there is NO token (app served without a host session), the analyst sets
// an editable sync id in Settings instead.

export interface OrgSync {
  // True once the host has handed us a session token.
  hasToken: boolean;
  // The organization id to scope the library on, when a token is present.
  orgId: string | null;
}

// Prefer the SDK-provided session.orgId; fall back to decoding the token.
export function useOrgSync(): OrgSync {
  const { session } = useHostContext();
  const hasToken = Boolean(session.token);
  const raw = session.orgId ?? decodeJwtOrgId(session.token);
  const orgId = raw && raw.trim() ? raw.trim() : null;
  return { hasToken, orgId };
}
