import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface VerifiedUser {
  id: string;
}

export type VerifyToken = (token: string) => Promise<VerifiedUser>;

/**
 * Verifies Supabase access tokens. Projects on asymmetric signing keys are
 * checked against the project's JWKS; legacy projects pass `jwtSecret`.
 */
export function createTokenVerifier(options: {
  supabaseUrl: string;
  jwtSecret?: string;
}): VerifyToken {
  const issuer = `${options.supabaseUrl.replace(/\/$/, "")}/auth/v1`;
  const key = options.jwtSecret
    ? new TextEncoder().encode(options.jwtSecret)
    : createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (token: string) => {
    if (!token) throw new Error("missing token");
    const { payload } = await jwtVerify(
      token,
      // jose's overloads differ for a key and a key set; both are valid here.
      key as Parameters<typeof jwtVerify>[1],
      { issuer, audience: "authenticated" },
    );
    return { id: subject(payload) };
  };
}

function subject(payload: JWTPayload): string {
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("token has no subject");
  }
  if (payload.role !== "authenticated") {
    throw new Error("token is not for a signed-in user");
  }
  return payload.sub;
}
