import { exportJWK, generateKeyPair, SignJWT } from "jose";

export type TestJwt = {
  token: string;
  jwks: { keys: unknown[] };
};

export async function createTestJwt(options: {
  issuer: string;
  audience: string;
  subject?: string;
  claims?: Record<string, unknown>;
  expiresIn?: string | number;
}): Promise<TestJwt> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const kid = `kid_${crypto.randomUUID()}`;
  let jwt = new SignJWT(options.claims ?? {})
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setIssuedAt();

  if (options.subject !== undefined) {
    jwt = jwt.setSubject(options.subject);
  }

  jwt = jwt.setExpirationTime(options.expiresIn ?? "5m");

  return {
    token: await jwt.sign(privateKey),
    jwks: { keys: [{ ...publicJwk, kid, alg: "RS256", use: "sig" }] },
  };
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
