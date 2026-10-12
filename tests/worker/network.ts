import { setupNetwork } from "@msw/cloudflare";
import { HttpResponse, http } from "msw";

export const network = setupNetwork();

export function mockJwks(issuer: string, jwks: { keys: unknown[] }): void {
  network.use(http.get(`${issuer}/jwks`, () => HttpResponse.json(jwks)));
}
