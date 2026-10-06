// Sets a user's privilege level directly in the database.
// Use it to create the first admin, or to recover if no admin can log in:
//   npm run set-level -- someone@example.com 100
// Levels: 1 = user, 2 = chef, 10 = moderator, 100 = admin.
import "dotenv/config";
import pg from "pg";

const LEVELS = { 1: "user", 2: "chef", 10: "moderator", 100: "admin" };
const [email, rawLevel] = process.argv.slice(2);
const level = Number(rawLevel);

if (!email || !(level in LEVELS)) {
  console.error("Usage: npm run set-level -- <email> <1|2|10|100>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (add it to .env)");
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows } = await db.query(
    `UPDATE "User" SET "privilegeLevel" = $2 WHERE lower(email) = lower($1) RETURNING name`,
    [email.trim(), level],
  );
  if (rows.length === 0) {
    console.error(`No account found for ${email}. Sign up in the app first.`);
    process.exitCode = 1;
  } else {
    console.log(
      `${rows[0].name} <${email}> is now ${LEVELS[level]} (level ${level}).`,
    );
  }
} finally {
  await db.end();
}
