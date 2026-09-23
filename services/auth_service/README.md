# Auth Service - Sprint 8

Enterprise Trading Platform Authentication Service built with NestJS.

## Overview

The Auth Service handles registration, login, token refresh, and current-user profile endpoints according to the contract specified in `contracts/auth-api.yaml`. This service issues JWT tokens for use across the platform.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure .env with your database and JWT_SECRET
# JWT_SECRET should be at least 64 characters
# Generate one with: openssl rand -base64 48
```

### Database Setup

```bash
# Create the auth database
createdb auth_db

# Create database user
createuser auth_user
# Set password in psql: ALTER USER auth_user WITH PASSWORD 'secure_password';
# Grant permissions: GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_user;

# Run migrations
psql -U auth_user -d auth_db -f migrations/001_initial_schema.sql
```

### Start the Service

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The service will start on port 3000 (or the PORT environment variable).

## API Endpoints

All endpoints return responses wrapped in the platform error envelope:

```json
{
  "errorCode": "AUTH-401|AUTH-409|VAL-422",
  "message": "Descriptive message"
}
```

### POST /auth/register

Register a new user and link to an existing trading account.

**Request:**
```json
{
  "username": "priya.menon",
  "password": "correct horse battery staple",
  "accountId": 1,
  "roles": ["CUSTOMER"]  // Optional, defaults to ["CUSTOMER"]
}
```

**Response (201):**
```json
{
  "id": "8f14e45f-ceea-4c1b-9d3b-1a2b3c4d5e6f",
  "username": "priya.menon",
  "accountId": 1,
  "roles": ["CUSTOMER"],
  "createdOn": "2026-10-05T08:00:00Z"
}
```

**Errors:**
- `AUTH-409`: Username already taken
- `VAL-422`: Validation error (see constraints below)

**Validation Rules:**
- `username`: 3-64 chars, pattern `^[a-zA-Z0-9._-]+$`
- `password`: 12-128 chars (no character-class requirements)
- `accountId`: positive integer, must exist in trade-api accounts

### POST /auth/login

Authenticate with credentials and receive token pair.

**Request:**
```json
{
  "username": "priya.menon",
  "password": "correct horse battery staple"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "9c1f7a2e4b6d8e0a2c4e6a8c0e2a4c6e8a0c2e4a6c8e0a2c",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

**Errors:**
- `AUTH-401`: Unknown user or invalid password (identical response for both)
- `VAL-422`: Validation error

### POST /auth/refresh

Exchange a refresh token for a new token pair.

**Request:**
```json
{
  "refreshToken": "9c1f7a2e4b6d8e0a2c4e6a8c0e2a4c6e8a0c2e4a6c8e0a2c"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "new-refresh-token-here",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

**Errors:**
- `AUTH-401`: Invalid/expired/consumed refresh token
- `VAL-422`: Validation error

**Important:** Double-use of a refresh token is treated as theft and revokes all tokens for that user.

### GET /auth/me

Get the authenticated user profile. Requires bearer token.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "id": "8f14e45f-ceea-4c1b-9d3b-1a2b3c4d5e6f",
  "username": "priya.menon",
  "accountId": 1,
  "roles": ["CUSTOMER"],
  "createdOn": "2026-10-05T08:00:00Z"
}
```

**Errors:**
- `AUTH-401`: Invalid/expired/missing token

## JWT Claims Contract

All access tokens carry these claims:

| Claim | Type | Meaning |
|---|---|---|
| `sub` | string | User ID (UUID) - stable for life of user |
| `accountId` | number | Trading account key from `accounts.id` |
| `roles` | string[] | Authorization roles: `CUSTOMER` or `ADMIN` |
| `iat` | number | Issued-at (seconds since Unix epoch) |
| `exp` | number | Expiry (15 minutes after iat) |
| `iss` | string | Issuer: `auth-service` |

Example decoded token:
```json
{
  "sub": "8f14e45f-ceea-4c1b-9d3b-1a2b3c4d5e6f",
  "accountId": 1,
  "roles": ["CUSTOMER"],
  "iat": 1790000000,
  "exp": 1790000900,
  "iss": "auth-service"
}
```

## Security Features

### Password Storage
- Passwords are hashed with **argon2id** (cost 3, memory 64MB)
- Never logged or exposed in error messages
- Minimum 12 characters required

### Token Lifecycle
- **Access tokens**: 15 minutes, not revocable (short-lived)
- **Refresh tokens**: 7 days, stored server-side, revocable
- Refresh tokens are rotated on each refresh
- Tokens are signed with HS256 and a shared secret

### Threat Mitigations
- **User enumeration**: Same response for unknown user and wrong password
- **Token reuse**: Consuming a token twice revokes all tokens for that user
- **Timing attacks**: Uniform response times for success and failure
- **Privilege escalation**: Clients cannot self-assign roles during registration

### Logging
- All auth events logged with `[AUTH_EVENT]` prefix
- Never logs passwords, tokens, or PII
- Events include: `register_attempt`, `login_attempt`, `refresh_attempt`, `token_reuse_detected`

## Database Schema

### auth_users
```sql
CREATE TABLE auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    account_id BIGINT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT ARRAY['CUSTOMER'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### refresh_tokens
```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);
```

## Testing

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | - | PostgreSQL host |
| `DB_PORT` | Yes | - | PostgreSQL port (usually 5432) |
| `DB_USERNAME` | Yes | - | PostgreSQL user |
| `DB_PASSWORD` | Yes | - | PostgreSQL password |
| `DB_NAME` | Yes | - | PostgreSQL database name |
| `JWT_SECRET` | Yes | - | Secret for JWT signing (min 32 chars) |
| `PORT` | No | 3000 | Service port |
| `NODE_ENV` | No | development | Environment mode |

## Integration with Trade API

The Trade API validates incoming access tokens:

1. **Same JWT_SECRET**: Both services must use the same secret for HS256 verification
2. **Issuer validation**: Trade API checks the `iss` claim is `auth-service`
3. **Account isolation**: Trade API compares `accountId` claim against request path/body
4. **Token verification**: Every request validates signature, expiry, and issuer

Example Trade API integration:
```typescript
// Verify token sent from client
const payload = jwt.verify(token, process.env.JWT_SECRET, {
  algorithms: ['HS256'],
  issuer: 'auth-service'
});

// Ensure user's accountId matches request
if (payload.accountId !== requestedAccountId) {
  throw new HttpException('ACC-403', HttpStatus.FORBIDDEN);
}
```

## Deployment Checklist

- [ ] Database created with proper schema
- [ ] Environment variables set (especially JWT_SECRET)
- [ ] Service can connect to database
- [ ] Rate limiting configured (recommended: 5 login attempts per minute)
- [ ] CORS configured for UI domain
- [ ] Monitoring alerts set for auth failures
- [ ] JWT_SECRET rotation procedure documented
- [ ] Logs captured and retained per compliance requirements

## Common Issues

**Issue**: "Cannot find module 'argon2'"
- **Solution**: Run `npm install` to ensure all dependencies are installed

**Issue**: Database connection refused
- **Solution**: Check DB_HOST, DB_PORT, and credentials in .env

**Issue**: "JWT_SECRET not set"
- **Solution**: Generate with `openssl rand -base64 48` and set in .env

**Issue**: "Port 3000 already in use"
- **Solution**: Set `PORT` environment variable or kill process on port 3000

## API Documentation

OpenAPI/Swagger documentation is available at:
- **Live**: http://localhost:3000/docs
- **JSON**: http://localhost:3000/docs/json

## License

Instructional use only. See root LICENSE file.
