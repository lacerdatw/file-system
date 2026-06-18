import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  port: parseInt(process.env["PORT"] ?? "3005", 10),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: requireEnv("JWT_SECRET"),
  awsRegion: requireEnv("AWS_REGION"),
  awsAccessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
  awsSecretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
  s3BucketName: requireEnv("S3_BUCKET_NAME"),
};
