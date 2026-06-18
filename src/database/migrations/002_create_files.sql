CREATE TABLE IF NOT EXISTS files (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename   VARCHAR(255) NOT NULL,
  s3_key     VARCHAR(512) NOT NULL,
  size       BIGINT,
  mime_type  VARCHAR(127),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
