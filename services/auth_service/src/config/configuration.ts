export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  schema: string;
  user: string;
  password: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtIssuer: string;
  jwtExpiresIn: number;
}

export interface AppConfig {
  port: number;
  environment: string;
  /** Origin of the web app (FRONTEND_URL:FRONTEND_PORT); the only browser origin allowed to call this service. */
  frontendOrigin: string;
  database: DatabaseConfig;
  auth: AuthConfig;
}

/**
 * Nothing environment-specific is written in code. Every value comes from the environment
 * (the repository's .env, see .env.example) and a missing one stops the service at start-up
 * instead of silently falling back to something that only works on one machine.
 */
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env at the repository root and fill it in.`,
    );
  }
  return value;
}

function requiredInt(name: string): number {
  const value = parseInt(required(name), 10);
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${name} must be a number.`);
  }
  return value;
}

/** The web app's origin, built from FRONTEND_URL and FRONTEND_PORT. Also used by the websocket gateway. */
export function frontendOrigin(): string {
  return `${required('FRONTEND_URL')}:${required('FRONTEND_PORT')}`;
}

export const configuration = (): AppConfig => ({
  port: requiredInt('AUTH_SERVICE_PORT'),
  environment: process.env.NODE_ENV || 'development',
  frontendOrigin: frontendOrigin(),
  database: {
    host: required('DB_HOST'),
    port: requiredInt('DB_PORT'),
    database: required('DB_NAME'),
    schema: required('DB_SCHEMA_AUTH'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },
  auth: {
    jwtSecret: required('JWT_SECRET'),
    jwtIssuer: required('JWT_ISSUER'),
    jwtExpiresIn: requiredInt('JWT_EXPIRES_IN'),
  },
});
