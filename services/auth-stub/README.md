# Auth stub

This stub exists for local orchestration in Sprint 6 and follows the JWT claims expected by `contracts/auth-api.yaml`.

## Endpoints

- `POST /auth/login`
- `GET /auth/me`
- `GET /health`

## Shared configuration

- `JWT_SECRET` (required): shared HS256 signing secret used by both stub and trade API verifier.
- `JWT_ISSUER` (optional, default `auth-service`): value emitted in `iss` and validated by trade API.

## Demo users

| Username | Password | accountId | roles |
|---|---|---:|---|
| `priya.menon` | `correct horse battery staple` | 1 | `["CUSTOMER"]` |
| `ops.admin` | `admin passphrase 123` | 2 | `["ADMIN"]` |

## Access token claims

```json
{
  "sub": "uuid",
  "accountId": 1,
  "roles": ["CUSTOMER"],
  "iat": 1790000000,
  "exp": 1790000900,
  "iss": "auth-service"
}
```
