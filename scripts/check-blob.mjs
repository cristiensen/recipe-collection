// Checks that this machine can authenticate to Vercel Blob the way the upload
// route does (Vercel OIDC + BLOB_STORE_ID), without uploading anything.
//   npm run check:blob
// Reads .env.local, then .env. If it fails with missing credentials, run
// `npx vercel env pull .env.local` (the OIDC token expires after ~12 hours).

import { issueSignedToken } from "@vercel/blob";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const missing = [
  "BLOB_STORE_ID",
  "BLOB_WEBHOOK_PUBLIC_KEY",
  "VERCEL_OIDC_TOKEN",
].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing: ${missing.join(", ")}`);
  console.error("Run `npx vercel link` and `npx vercel env pull .env.local`.");
  process.exit(1);
}

try {
  const token = await issueSignedToken({
    pathname: "recipes/images/check.jpg",
    operations: ["put"],
  });
  console.log(
    `OK: Blob accepted the credentials (token valid until ${new Date(token.validUntil).toISOString()}).`,
  );
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
}
