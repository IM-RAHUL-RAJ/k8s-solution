import { environment } from '../../../environments/environment';

export const API_ENDPOINTS = {
  tradeApiBase: "http://10.8.76.150:8084",//environment.tradeApiBase,
  authApiBase: "http://localhost:3000",//environment.authApiBase,
  tradeApiHealth: `http://10.8.76.150:8084/actuator/health`,//`${environment.tradeApiBase}/actuator/health`,
  authApiHealth: `${environment.authApiBase}/health`,
  marketInstruments: null as string | null,
  currencyConverter: null as string | null
} as const;

function originOf(base: string): string {
  return new URL(base || '/', window.location.origin).origin;
}

/**
 * The allow list for the bearer token: an origin this platform owns plus the paths on it that
 * are protected. Everything else, including other paths on the same origin (static assets)
 * and every other host, never receives the token.
 *
 * The auth service's /auth/login, /auth/register and /auth/refresh are `security: []` in the
 * contract and take no header, so they are deliberately absent.
 */
export interface PlatformTarget {
  origin: string;
  pathPrefixes: readonly string[];
  exactPaths: readonly string[];
}

export function platformTargets(): readonly PlatformTarget[] {
  return [
    { origin: originOf(environment.tradeApiBase), pathPrefixes: ['/api/v1/'], exactPaths: [] },
    { origin: originOf(environment.authApiBase), pathPrefixes: [], exactPaths: ['/auth/me'] }
  ];
}
