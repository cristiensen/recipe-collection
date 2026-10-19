import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

/** Direct database access for test setup that has no UI (e.g. the first admin). */
async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

export function setLevel(email: string, level: number) {
  return withDb((db) =>
    db.query(`UPDATE "User" SET "privilegeLevel" = $2 WHERE email = $1`, [
      email,
      level,
    ]),
  );
}

/** The id of the account with this email. */
export function userId(email: string) {
  return withDb(async (db) => {
    const { rows } = await db.query(`SELECT id FROM "User" WHERE email = $1`, [
      email,
    ]);
    return rows[0]?.id as string;
  });
}

export function likeRecipe(recipeId: string, email: string) {
  return withDb((db) =>
    db.query(
      `INSERT INTO "RecipeLike" ("recipeId", "userId") SELECT $1, id FROM "User" WHERE email = $2`,
      [recipeId, email],
    ),
  );
}

export function banUser(email: string) {
  return withDb((db) =>
    db.query(`UPDATE "User" SET "bannedAt" = now() WHERE email = $1`, [email]),
  );
}

/** Deletes test users matching a LIKE pattern; their content cascades. */
export function deleteUsers(emailPattern: string) {
  return withDb((db) =>
    db.query(`DELETE FROM "User" WHERE email LIKE $1`, [emailPattern]),
  );
}

/** Inserts a minimal recipe by `authorEmail` and returns its id. */
export function insertRecipe(
  authorEmail: string,
  title: string,
  media: {
    imageUrls?: string[];
    videoUrl?: string;
    /** Label slugs. */
    labels?: string[];
    cookingMinutes?: number;
    /** Ingredient names, in order. */
    ingredients?: string[];
  } = {},
) {
  return withDb(async (db) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO "Recipe" (id, title, description, "cookingMinutes", labels, "videoUrl", "authorId", "updatedAt")
       SELECT $1, $2, 'Test recipe', $6, $5::text[], $4, id, now() FROM "User" WHERE email = $3`,
      [
        id,
        title,
        authorEmail,
        media.videoUrl ?? null,
        media.labels ?? [],
        media.cookingMinutes ?? 20,
      ],
    );
    for (const [position, url] of (media.imageUrls ?? []).entries()) {
      await db.query(
        `INSERT INTO "RecipeImage" (id, "recipeId", url, position) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), id, url, position],
      );
    }
    for (const [position, name] of (media.ingredients ?? ["Water"]).entries()) {
      await db.query(
        `INSERT INTO "Ingredient" (id, "recipeId", position, name) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), id, position, name],
      );
    }
    await db.query(
      `INSERT INTO "Step" (id, "recipeId", position, text) VALUES ($1, $2, 0, 'Boil.')`,
      [randomUUID(), id],
    );
    return id;
  });
}

export function insertReview(
  recipeId: string,
  reviewerEmail: string,
  rating: number,
  comment: string,
) {
  return withDb((db) =>
    db.query(
      `INSERT INTO "Review" (id, "recipeId", "userId", rating, comment)
       SELECT $1, $2, id, $3, $4 FROM "User" WHERE email = $5`,
      [randomUUID(), recipeId, rating, comment, reviewerEmail],
    ),
  );
}

/** Creates an account that can log in with `password` (low bcrypt cost: tests only). */
export function createUser(
  email: string,
  name: string,
  level: number,
  password: string,
) {
  return withDb((db) =>
    db.query(
      `INSERT INTO "User" (id, name, email, "passwordHash", "privilegeLevel", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, now())`,
      [randomUUID(), name, email, bcrypt.hashSync(password, 4), level],
    ),
  );
}

/** A recipe's all-time views and the views counted for it today. */
export function recipeViews(recipeId: string) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      `SELECT r."viewCount" AS total, COALESCE(SUM(v.count), 0)::int AS today
       FROM "Recipe" r
       LEFT JOIN "RecipeViewDay" v ON v."recipeId" = r.id
         AND v.day = (now() AT TIME ZONE 'UTC')::date
       WHERE r.id = $1
       GROUP BY r.id`,
      [recipeId],
    );
    return rows[0] as { total: number; today: number };
  });
}

/** Adds `count` views to a recipe on the UTC day `daysAgo` days back. */
export function addRecipeViews(recipeId: string, count: number, daysAgo = 0) {
  return withDb((db) =>
    db.query(
      `INSERT INTO "RecipeViewDay" ("recipeId", day, count)
       VALUES ($1, (now() AT TIME ZONE 'UTC')::date - $3::int, $2)
       ON CONFLICT ("recipeId", day)
       DO UPDATE SET count = "RecipeViewDay".count + $2`,
      [recipeId, count, daysAgo],
    ),
  );
}

/** Deletes labels by slug (deleting their creator keeps them). */
export function deleteLabels(slugs: string[]) {
  return withDb(async (db) => {
    await db.query(
      `UPDATE "Recipe" SET labels = array_remove(labels, s)
       FROM unnest($1::text[]) s WHERE labels @> ARRAY[s]`,
      [slugs],
    );
    await db.query(`DELETE FROM "Label" WHERE slug = ANY($1)`, [slugs]);
  });
}

/** Backdates a label, e.g. past the window in which its creator can delete it. */
export function setLabelCreatedAt(slug: string, minutesAgo: number) {
  return withDb((db) =>
    db.query(
      `UPDATE "Label" SET "createdAt" = (now() AT TIME ZONE 'UTC') - make_interval(mins => $2::int)
       WHERE slug = $1`,
      [slug, minutesAgo],
    ),
  );
}

/** Adds labels until there are `total`; returns the slugs it added. */
export function fillLabels(total: number, prefix: string) {
  return withDb(async (db) => {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM "Label"`);
    const slugs = Array.from(
      { length: Math.max(0, total - rows[0].n) },
      (_, i) => `${prefix}-${i}`,
    );
    await db.query(
      `INSERT INTO "Label" (slug, name) SELECT s, s FROM unnest($1::text[]) s`,
      [slugs],
    );
    return slugs;
  });
}
