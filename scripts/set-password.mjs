// Sets a new password for an account directly in the database. Use it to
// recover an account the reset email can't reach:
//   npm run set-password -- someone@example.com
// The password is asked for without echoing, so it stays out of the shell
// history. Rules match sign-up: 8–72 characters.
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import "dotenv/config";
import pg from "pg";

const [email] = process.argv.slice(2);

if (!email) {
  console.error("Usage: npm run set-password -- <email>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (add it to .env)");
  process.exit(1);
}

// One reader for both prompts (it buffers lines that arrive early); typed
// characters are not echoed
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});
rl._writeToOutput = () => {};
const lines = rl[Symbol.asyncIterator]();

/** Reads one line from the terminal without showing what is typed. */
async function askHidden(question) {
  process.stdout.write(question);
  const { value } = await lines.next();
  process.stdout.write("\n");
  return value ?? "";
}

const password = await askHidden("New password: ");
const repeated = await askHidden("Repeat it: ");
rl.close();
if (password.length < 8 || password.length > 72) {
  console.error("Password must be 8–72 characters.");
  process.exit(1);
}
if (repeated !== password) {
  console.error("The passwords don't match.");
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows } = await db.query(
    `UPDATE "User" SET "passwordHash" = $2, "updatedAt" = now() WHERE lower(email) = lower($1) RETURNING name`,
    [email.trim(), await bcrypt.hash(password, 12)],
  );
  if (rows.length === 0) {
    console.error(`No account found for ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(`Password updated for ${rows[0].name} <${email}>.`);
  }
} finally {
  await db.end();
}
