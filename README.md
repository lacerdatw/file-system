# File System API

A REST API for authenticated file storage backed by AWS S3 and PostgreSQL.

Built as a study project to practice Node.js (TypeScript), Express, AWS SDK v3, and PostgreSQL — following TDD, clean architecture and the principle of least privilege on AWS.

![CI](https://github.com/lacerdatw/file-system/actions/workflows/ci.yml/badge.svg)

---

## Tech stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Runtime     | Node.js 22 + TypeScript             |
| Framework   | Express 5                           |
| Database    | PostgreSQL (via `pg`)               |
| File storage| AWS S3 (SDK v3)                     |
| Auth        | JWT (jsonwebtoken) + bcrypt         |
| Validation  | Zod                                 |
| Testing     | Jest + Supertest + aws-sdk-client-mock |
| Linting     | ESLint (typescript-eslint) + Prettier |

---

## Architecture

```
src/
  config/         # env validation, DB pool, S3 client
  modules/
    auth/         # register, login — repository → service → controller → router
    files/        # upload, list, download, delete — same layered structure
  middlewares/    # JWT auth, error handler
  database/       # SQL migrations + migrate script
  app.ts          # Express setup
  server.ts       # entry point (port 3005)
```

Each module follows the same pattern: **repository** (DB queries) → **service** (business logic) → **controller** (HTTP) → **router**.

---

## API

| Method | Path                  | Auth | Description                        |
|--------|-----------------------|------|------------------------------------|
| POST   | /auth/register        | No   | Create account                     |
| POST   | /auth/login           | No   | Returns JWT                        |
| POST   | /files/upload         | Yes  | Upload file to S3                  |
| GET    | /files                | Yes  | List your files                    |
| GET    | /files/:id/download   | Yes  | Get pre-signed S3 URL (15 min)     |
| DELETE | /files/:id            | Yes  | Delete file from S3 and DB         |

### Download flow
Files are never proxied through the API. The `/download` endpoint returns a short-lived S3 pre-signed URL and the client downloads directly from S3.

---

## Local setup

**Prerequisites:** Docker, Node.js 22, an AWS account with an S3 bucket.

```bash
# 1. Clone and install
git clone https://github.com/lacerdatw/file-system.git
cd file-system
npm install

# 2. Environment
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET and AWS credentials

# 3. Start PostgreSQL
docker-compose up -d

# 4. Run migrations
npm run migrate

# 5. Start the server (port 3005)
npm run dev
```

---

## AWS setup

Create a dedicated IAM user (`file-system-app`) with only the permissions this app needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET",
        "arn:aws:s3:::YOUR_BUCKET/*"
      ]
    }
  ]
}
```

Generate an access key for that user and put the credentials in `.env`.

---

## Development

```bash
npm test               # run all tests
npm run test:coverage  # tests + coverage report
npm run lint           # ESLint
npm run format         # Prettier
npm run build          # compile to dist/
```

---

## Environment variables

| Variable              | Description                        |
|-----------------------|------------------------------------|
| `PORT`                | Server port (default 3005)         |
| `DATABASE_URL`        | PostgreSQL connection string       |
| `JWT_SECRET`          | Secret for signing JWTs            |
| `AWS_REGION`          | S3 bucket region                   |
| `AWS_ACCESS_KEY_ID`   | IAM user access key                |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key              |
| `S3_BUCKET_NAME`      | Target S3 bucket                   |
