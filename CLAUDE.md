# File System — Backend

Study project covering Node.js (TypeScript), Express, PostgreSQL and AWS S3.
Runs on port **3005**. Follow TDD with Jest and avoid code smells.

---

## How the server starts

```
npm run dev
  → ts-node src/server.ts
    → import env (validates all required env vars — crashes fast if any are missing)
    → import app (Express app, routes, middlewares)
    → app.listen(3005)
```

`src/config/env.ts` calls `requireEnv()` for every key at import time, so the process exits immediately if `.env` is incomplete — no silent failures at runtime.

---

## Environment variables

| Variable               | Purpose                                  |
|------------------------|------------------------------------------|
| `DATABASE_URL`         | PostgreSQL connection string             |
| `JWT_SECRET`           | Signs and verifies JWT tokens            |
| `AWS_REGION`           | S3 bucket region (e.g. `us-east-1`)     |
| `AWS_ACCESS_KEY_ID`    | IAM user credential                      |
| `AWS_SECRET_ACCESS_KEY`| IAM user credential                      |
| `S3_BUCKET_NAME`       | Target S3 bucket                         |
| `PORT`                 | Optional, defaults to `3005`             |

---

## Database setup

Migrations run manually with `npm run migrate` before the first start.

```
npm run migrate
  → ts-node src/database/migrate.ts
    → reads src/database/migrations/*.sql sorted alphabetically
    → runs each file against DATABASE_URL with pg Pool
```

**001_create_users.sql**
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- needed for gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**002_create_files.sql**
```sql
CREATE TABLE IF NOT EXISTS files (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename   VARCHAR(255) NOT NULL,
  s3_key     VARCHAR(512) NOT NULL,   -- path inside the S3 bucket
  size       BIGINT,
  mime_type  VARCHAR(127),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`ON DELETE CASCADE` means deleting a user also deletes all their file rows.

---

## Singletons

`src/config/database.ts` exports a single `pg.Pool` instance shared across all repository calls. Opening one pool at startup is more efficient than connecting per request.

`src/config/s3.ts` exports a single `S3Client` instance configured with the IAM credentials. All S3 commands go through this client.

---

## Request lifecycle

Every request passes through these layers in order:

```
Request
  → cors middleware          (allows cross-origin requests from the frontend)
  → express.json()           (parses JSON body)
  → loggerMiddleware         (logs [req] method + path)
  → router match
      → authMiddleware       (only on /files/* routes)
      → controller handler   (validates input with Zod, calls service)
          → service          (business logic)
              → repository   (SQL queries via pg Pool)
              → S3 commands  (via AWS SDK)
  → loggerMiddleware finish  (logs [res] method + path + status + ms)
  → errorMiddleware          (catches any thrown error, returns 500)
```

---

## Auth flow — step by step

### POST /auth/register

1. Controller parses body with Zod schema: `{ email: string (email format), password: string (min 8) }` → 400 if invalid
2. `auth.service.register`:
   - queries DB for existing user with that email → 409 if found
   - hashes password with `bcrypt.hash(password, 10)` (10 salt rounds)
   - inserts new row into `users` table via `auth.repository.createUser`
   - returns user row **without** `password_hash`
3. Response: `201 { id, email, created_at }`

> The frontend then immediately calls `/auth/login` with the same credentials to get a JWT.

### POST /auth/login

1. Zod validates `{ email, password }`
2. `auth.service.login`:
   - looks up user by email → 401 if not found
   - `bcrypt.compare(password, user.password_hash)` → 401 if mismatch
   - `jwt.sign({ sub: user.id, email }, JWT_SECRET, { expiresIn: '7d' })`
3. Response: `200 { token }`

The JWT payload carries `sub` (userId) and `email`. It is stateless — the server holds no session.

---

## Auth middleware — how protected routes work

Every `/files/*` route goes through `authMiddleware` first:

1. Reads the `Authorization` header → 401 if missing or not `Bearer <token>`
2. `jwt.verify(token, JWT_SECRET)` → 401 if expired or tampered
3. Attaches `req.userId` and `req.userEmail` from the payload
4. Calls `next()` so the route handler runs

Controllers then read `req.userId` to scope all DB queries to the logged-in user.

---

## File operations — step by step

### POST /files/upload

1. `authMiddleware` verifies JWT, attaches `userId`
2. `multer({ storage: memoryStorage() })` reads the multipart body and puts the file bytes into `req.file.buffer` (never touches disk)
3. Controller checks `req.file` exists → 400 if not
4. `files.service.upload`:
   - builds S3 key: `{userId}/{randomUUID()}-{originalFilename}` — namespaced by user, collision-safe
   - `s3Client.send(new PutObjectCommand({ Bucket, Key, Body: buffer, ContentType }))` — streams buffer to S3
   - `files.repository.createFile` inserts metadata row into PostgreSQL
5. Response: `201 { id, user_id, filename, s3_key, size, mime_type, created_at }`

### GET /files

1. Auth middleware runs
2. `files.service.listFiles(userId)` → `SELECT * FROM files WHERE user_id = $1 ORDER BY created_at DESC`
3. Response: `200 [FileRow, ...]`

Users never see each other's files because every query filters by `user_id`.

### GET /files/:id/download

1. Auth middleware runs
2. `files.service.getDownloadUrl(fileId, userId)`:
   - `findFileById(id, userId)` — SELECT with both `id` AND `user_id` → 404 if not found (also prevents accessing other users' files)
   - `getSignedUrl(s3Client, new GetObjectCommand({ Bucket, Key: file.s3_key }), { expiresIn: 900 })`
   - The AWS SDK signs the URL with the IAM credentials; the URL encodes expiry (900 s = 15 min) and a signature
3. Response: `200 { url }`

The client then opens the pre-signed URL **directly** in the browser. The API is not involved in the actual file transfer — S3 validates the signature and serves the bytes.

### DELETE /files/:id

1. Auth middleware runs
2. `files.service.remove(fileId, userId)`:
   - `findFileById(id, userId)` → 404 if not found
   - `s3Client.send(new DeleteObjectCommand({ Bucket, Key: file.s3_key }))` — removes from S3
   - `files.repository.deleteFile(id, userId)` — `DELETE FROM files WHERE id = $1 AND user_id = $2`
3. Response: `204 No Content`

Both S3 and DB are cleaned up. If S3 delete succeeds but DB delete fails, the error middleware returns 500 — the S3 object would be orphaned (acceptable for a study project; production would use a transaction or a cleanup job).

---

## Error handling

`errorMiddleware` is registered last in `app.ts`. Any error thrown inside a route handler and passed to `next(err)` lands here:

```ts
console.error(`[error] ${message}`, err.stack)
res.status(500).json({ error: message })
```

Known errors (wrong credentials, file not found) are handled inline in controllers before reaching this middleware, with specific 4xx status codes.

---

## AWS IAM setup

The IAM user `file-system-app` has a minimal inline policy:

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
  "Resource": [
    "arn:aws:s3:::YOUR_BUCKET",
    "arn:aws:s3:::YOUR_BUCKET/*"
  ]
}
```

No other AWS permissions. Credentials are in `.env`, never in code.

---

## Pre-signed URL — why it works without a token

A pre-signed URL is a regular HTTPS URL with AWS query parameters (`X-Amz-Signature`, `X-Amz-Expires`, etc.) computed using the IAM credentials at the time of signing. S3 re-computes the signature on its end to verify it. The URL is valid for 15 minutes and carries no JWT — it authenticates the *request*, not the *user*. Once issued, anyone with the URL can download the file until it expires.

---

## Logging

`loggerMiddleware` logs every request on arrival and on response finish:

```
[server] listening on port 3005
[req] POST /auth/login
[res] POST /auth/login 200 14ms
[error] Invalid credentials
```
