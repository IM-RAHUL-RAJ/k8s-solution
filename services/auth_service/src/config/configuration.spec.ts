import { configuration } from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load default configuration when environment variables are not set', () => {
    delete process.env.PORT;
    delete process.env.DB_HOST;
    delete process.env.JWT_SECRET;

    const config = configuration();
    expect(config.port).toBe(3000);
    expect(config.database.host).toBe('localhost');
    expect(config.auth.jwtIssuer).toBe('auth-service');
  });

  it('should load configuration from environment variables at runtime', () => {
    process.env.PORT = '4000';
    process.env.DB_HOST = 'postgres-db';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'test_db';
    process.env.DB_USER = 'test_user';
    process.env.DB_PASSWORD = 'test_password';
    process.env.JWT_SECRET = 'custom-secret-key-12345678901234567890';
    process.env.JWT_ISSUER = 'custom-issuer';

    const config = configuration();
    expect(config.port).toBe(4000);
    expect(config.database.host).toBe('postgres-db');
    expect(config.database.port).toBe(5433);
    expect(config.database.database).toBe('test_db');
    expect(config.database.user).toBe('test_user');
    expect(config.database.password).toBe('test_password');
    expect(config.auth.jwtSecret).toBe('custom-secret-key-12345678901234567890');
    expect(config.auth.jwtIssuer).toBe('custom-issuer');
    expect(config.auth.jwtExpiresIn).toBe(900);
  });
});

