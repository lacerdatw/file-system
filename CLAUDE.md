### File System

- This is a study project to ensure knowledge in node(with ts), react and AWS.
- This codebase represents the backend;
- Is going to run on 3005;
- The keys are going to be setted in the environment;
- I want to follow best practices: Test Driven Development ( with jest ), avoid code smells, etc.

---

### System Design

#### Overview
REST API that lets authenticated users upload, list, download and delete files stored in AWS S3. Metadata (filename, owner, S3 key, size, mime type) is persisted in PostgreSQL.

#### Architecture

```
src/
  config/
    env.ts          # validates required env vars at startup
    database.ts     # pg Pool singleton
    s3.ts           # S3Client singleton
  modules/
    auth/
      auth.repository.ts   # DB queries (users)
      auth.service.ts      # register/login — bcrypt + JWT
      auth.controller.ts   # request validation + HTTP responses
      auth.router.ts
      auth.service.test.ts
      auth.controller.test.ts
    files/
      files.repository.ts  # DB queries (files metadata)
      files.service.ts     # S3 operations + metadata persistence
      files.controller.ts
      files.router.ts
      files.service.test.ts
      files.controller.test.ts
  middlewares/
    auth.middleware.ts    # JWT verification, attaches userId to req
    error.middleware.ts   # centralised error handler
  database/
    migrate.ts
    migrations/
      001_create_users.sql
      002_create_files.sql
  app.ts      # Express app setup
  server.ts   # binds to port 3005
index.ts
```

#### API Endpoints

| Method | Path                  | Auth | Description                        |
|--------|-----------------------|------|------------------------------------|
| POST   | /auth/register        | No   | Create user (email + password)     |
| POST   | /auth/login           | No   | Returns JWT                        |
| POST   | /files/upload         | Yes  | Multipart upload → S3 + metadata   |
| GET    | /files                | Yes  | List files owned by caller         |
| GET    | /files/:id/download   | Yes  | Returns S3 pre-signed URL (15 min) |
| DELETE | /files/:id            | Yes  | Delete from S3 + metadata row      |

#### File upload flow
```
Client → POST /files/upload (multipart)
  → authMiddleware (verify JWT)
  → multer (buffer in memory)
  → filesService.upload → PutObjectCommand → S3
  → filesRepository.createFile → PostgreSQL
  → 201 { file metadata }
```

#### File download flow
```
Client → GET /files/:id/download
  → authMiddleware (verify JWT)
  → filesService.getDownloadUrl → getSignedUrl (GetObjectCommand, 15 min TTL)
  → 200 { url }
Client → fetches S3 pre-signed URL directly (API not involved)
```

#### Database schema

**users** — `id` (UUID PK), `email` (unique), `password_hash`, `created_at`

**files** — `id` (UUID PK), `user_id` (FK → users), `filename`, `s3_key`, `size`, `mime_type`, `created_at`

#### Auth
- Stateless JWT (7 day expiry), signed with `JWT_SECRET`
- Passwords hashed with bcrypt (10 rounds)
- Each file row is scoped to `user_id` — users can only access their own files

#### AWS
- One dedicated IAM user (`file-system-app`) with a policy restricted to `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` on the app bucket only
- S3 key format: `{userId}/{uuid}-{originalFilename}`
- Downloads use pre-signed URLs — files are served directly from S3, not proxied through the API
