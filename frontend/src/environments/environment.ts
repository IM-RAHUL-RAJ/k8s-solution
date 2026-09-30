// Where the browser finds the platform APIs. An empty base means "this origin": the dev
// server (proxy.conf.json) forwards /api, /auth and /actuator to the Trade REST API
// (localhost:8084) and the auth service (localhost:3000), so the browser never makes a
// cross-origin call and no CORS rule is needed. For a build served from elsewhere, set an
// absolute origin such as 'https://api.example.com'.
//
// Token attachment is decided from these values (core/interceptors/auth.interceptor.ts).
// Nothing in this file is secret: the bundle is public.
export const environment = {
  production: false,
  tradeApiBase: 'http://10.8.76.150:8084',
  authApiBase: 'http://localhost:3000'
};
