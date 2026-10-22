import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Password reset tokens live in Auth.js's `VerificationToken` table under
 * `password-reset:<userId>`. Only a hash is stored, so a database leak
 * doesn't leak working links. A token is valid for an hour and works once.
 */
const PREFIX = "password-reset:";
const TOKEN_TTL_MS = 60 * 60 * 1000;
/** Requests for the same account closer together than this send nothing. */
const RESEND_AFTER_MS = 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * A new reset token for the account, replacing any earlier one; null if one
 * was issued within the last minute (so the form can't flood an inbox).
 */
export async function createResetToken(userId: string): Promise<string | null> {
  const identifier = PREFIX + userId;
  const recent = await prisma.verificationToken.findFirst({
    where: {
      identifier,
      expires: { gt: new Date(Date.now() + TOKEN_TTL_MS - RESEND_AFTER_MS) },
    },
  });
  if (recent) return null;

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: hashToken(token),
        expires: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);
  return token;
}

/** The id of the account an unexpired token belongs to, or null. */
export async function resetTokenUser(token: string): Promise<string | null> {
  const row = await prisma.verificationToken.findFirst({
    where: {
      token: hashToken(token),
      identifier: { startsWith: PREFIX },
      expires: { gt: new Date() },
    },
  });
  return row ? row.identifier.slice(PREFIX.length) : null;
}

/**
 * Uses the token to set a new password. Returns the account, or null if the
 * token is invalid, expired or already used.
 */
export async function resetPassword(token: string, password: string) {
  const userId = await resetTokenUser(token);
  if (!userId) return null;
  const passwordHash = await bcrypt.hash(password, 12);
  // Deleting the token claims it: if the form is submitted twice at once,
  // only one request deletes the row
  const { count } = await prisma.verificationToken.deleteMany({
    where: { identifier: PREFIX + userId, token: hashToken(token) },
  });
  if (count === 0) return null;
  // Any other link sent to this account stops working too. Tokens outlive
  // deleted accounts, hence updateMany.
  const [, updated] = await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: { identifier: PREFIX + userId },
    }),
    prisma.user.updateMany({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    }),
  ]);
  if (updated.count === 0) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
}
