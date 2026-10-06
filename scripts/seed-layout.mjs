// Inserts 15 dummy recipes for checking layouts (cards, pagination, filters,
// recipe pages). All data belongs to dedicated seed accounts, so it can be
// removed in one go without touching real data.
//
//   npm run seed:layout            add (or re-create) the dummy recipes
//   npm run seed:layout -- --remove  remove them again
//
// Photos are generated images saved to .uploads/ (the development upload
// folder), so they display under `npm run dev` only.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import pg from "pg";

const SEED_DOMAIN = "@example.test";
const SEED_PREFIX = "layout-seed-";
const UPLOAD_DIR = path.join(process.cwd(), ".uploads");
const FILE_PREFIX = "seed-";

// ─────────────────────────────── Fake data ───────────────────────────────

const TITLES = [
  "Pie",
  "Lemon Tart",
  "Quick Weeknight Chicken Curry",
  "Grandma's Sunday Roast with Crispy Potatoes and Gravy",
  "Miso Soup",
  "Spicy Black Bean Burgers with Chipotle Mayo and Pickled Red Onions",
  "Pancakes",
  "Overnight Oats",
  "Slow-Cooked Beef Ragù",
  "Vegan Chocolate Avocado Mousse",
  "Shakshuka",
  "Gluten-Free Banana Bread That Actually Tastes Like Banana Bread",
  "Pad Thai",
  "Caprese Salad",
  "Three-Day Sourdough Loaf (Beginner Friendly, With Lots of Photos)",
];
const LABELS = [
  "VEGAN",
  "VEGETARIAN",
  "GLUTEN_FREE",
  "DAIRY_FREE",
  "SPICY",
  "DESSERT",
  "BREAKFAST",
  "QUICK",
];
const UNITS = ["g", "kg", "ml", "cup", "tbsp", "tsp", "clove", "pinch", null];
const WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(
    " ",
  );
const TIMES = [5, 10, 15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180, 240, 35];
const SHAPES = [
  [960, 640], // landscape
  [640, 960], // portrait
  [800, 800], // square
  [1200, 450], // panorama
];

// Deterministic pseudo-random numbers so every run produces the same data
let randomState = 42;
const rand = () => {
  randomState = (randomState * 1664525 + 1013904223) % 2 ** 32;
  return randomState / 2 ** 32;
};
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (list) => list[int(0, list.length - 1)];
const words = (n) => Array.from({ length: n }, () => pick(WORDS)).join(" ");
const sentence = (n) => {
  const s = words(n);
  return `${s[0].toUpperCase()}${s.slice(1)}.`;
};

// ───────────────────────────── PNG generation ─────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A diagonal two-colour gradient PNG, so each photo looks distinct. */
function gradientPng(width, height, from, to) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2;
      for (let c = 0; c < 3; c++) {
        raw[row + 1 + x * 3 + c] = Math.round(from[c] + (to[c] - from[c]) * t);
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const randomColor = () => [int(30, 255), int(30, 255), int(30, 255)];

// ──────────────────────────────── Database ────────────────────────────────

async function removeSeed(db) {
  const { rowCount } = await db.query(
    `DELETE FROM "User" WHERE email LIKE $1`,
    [`${SEED_PREFIX}%${SEED_DOMAIN}`],
  );
  let files = 0;
  try {
    for (const f of readdirSync(UPLOAD_DIR)) {
      if (f.startsWith(FILE_PREFIX)) {
        rmSync(path.join(UPLOAD_DIR, f));
        files++;
      }
    }
  } catch {
    // no upload folder yet
  }
  return { users: rowCount, files };
}

async function createUser(db, name, email) {
  const id = randomUUID();
  // No password: these accounts can't log in.
  await db.query(
    `INSERT INTO "User" (id, name, email, "privilegeLevel", "updatedAt") VALUES ($1, $2, $3, 2, now())`,
    [id, name, email],
  );
  return id;
}

async function seed(db) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const chefId = await createUser(
    db,
    "Layout Test Chef",
    `${SEED_PREFIX}chef${SEED_DOMAIN}`,
  );
  const reviewerIds = [];
  for (const name of [
    "Ana Reviewer",
    "Ben Reviewer",
    "Cleo Reviewer",
    "Dev Reviewer",
  ]) {
    reviewerIds.push(
      await createUser(
        db,
        name,
        `${SEED_PREFIX}${name.split(" ")[0].toLowerCase()}${SEED_DOMAIN}`,
      ),
    );
  }

  let photoCount = 0;
  for (const [i, title] of TITLES.entries()) {
    const id = randomUUID();
    const labels = [
      ...new Set(Array.from({ length: int(0, 6) }, () => pick(LABELS))),
    ];
    const description = Array.from({ length: int(1, 3) }, () =>
      sentence(int(8, 40)),
    ).join("\n\n");
    // Newest first on the browse page: spread creation dates over past days
    const createdAt = new Date(Date.now() - (i + 1) * 36e5 * int(5, 30));
    await db.query(
      `INSERT INTO "Recipe" (id, title, description, "cookingMinutes", servings, labels, "authorId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::"Label"[], $7, $8, $8)`,
      [
        id,
        title,
        description,
        TIMES[i],
        rand() < 0.3 ? null : int(1, 12),
        labels,
        chefId,
        createdAt,
      ],
    );

    for (let p = 0; p < int(1, 5); p++) {
      const [w, h] = pick(SHAPES);
      const file = `${FILE_PREFIX}${id.slice(0, 8)}-${p}.png`;
      writeFileSync(
        path.join(UPLOAD_DIR, file),
        gradientPng(w, h, randomColor(), randomColor()),
      );
      await db.query(
        `INSERT INTO "RecipeImage" (id, "recipeId", url, position) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), id, `/api/uploads/${file}`, p],
      );
      photoCount++;
    }
    for (let p = 0; p < int(1, 12); p++) {
      const unit = pick(UNITS);
      await db.query(
        `INSERT INTO "Ingredient" (id, "recipeId", position, name, quantity, unit) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          id,
          p,
          words(int(1, 4)),
          rand() < 0.2 ? null : int(1, 500),
          unit,
        ],
      );
    }
    for (let p = 0; p < int(1, 8); p++) {
      await db.query(
        `INSERT INTO "Step" (id, "recipeId", position, text) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), id, p, sentence(int(6, 60))],
      );
    }
    // Roughly a third of recipes stay unrated ("No ratings yet")
    if (rand() > 0.33) {
      for (const reviewerId of reviewerIds.slice(
        0,
        int(1, reviewerIds.length),
      )) {
        await db.query(
          `INSERT INTO "Review" (id, "recipeId", "userId", rating, comment) VALUES ($1, $2, $3, $4, $5)`,
          [
            randomUUID(),
            id,
            reviewerId,
            int(1, 5),
            rand() < 0.6 ? sentence(int(4, 50)) : null,
          ],
        );
      }
    }
  }
  return { recipes: TITLES.length, photos: photoCount };
}

// ──────────────────────────────────── Run ────────────────────────────────────

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (add it to .env)");
  process.exit(1);
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("BEGIN");
  const removed = await removeSeed(db);
  if (process.argv.includes("--remove")) {
    await db.query("COMMIT");
    console.log(
      `Removed ${removed.users} seed accounts (and their recipes) and ${removed.files} photos.`,
    );
  } else {
    const added = await seed(db);
    await db.query("COMMIT");
    console.log(
      `Added ${added.recipes} dummy recipes with ${added.photos} photos by "Layout Test Chef".` +
        " Run `npm run seed:layout -- --remove` to delete them.",
    );
  }
} catch (e) {
  await db.query("ROLLBACK");
  console.error("Seeding failed; nothing was changed in the database.", e);
  process.exitCode = 1;
} finally {
  await db.end();
}
