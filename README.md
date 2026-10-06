# Recipe Collection

Home cooks publish recipes with photos and video; other cooks rate, review and vote on reviews.
Built from the *Recipe Sharing Platform — Product Requirements (MVP)*.

**Stack:** Next.js 16 (App Router, Server Actions) · PostgreSQL via Prisma 7 · Auth.js (email + password, Prisma adapter) · Vercel Blob · Zod · Tailwind CSS + shadcn/ui · Vitest · Playwright

## Getting started

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and AUTH_SECRET (npx auth secret)
npx prisma migrate deploy   # create the tables
npm run dev                 # http://localhost:3000
```

Without `BLOB_READ_WRITE_TOKEN`, uploads in development go to `./.uploads` and are served from `/api/uploads/*`.
Production requires Vercel Blob; the local fallback is disabled there.

## Privilege levels

| Level | Role | Can |
| --- | --- | --- |
| 1 | User (every new account) | browse, search, rate and review, vote on reviews |
| 2 | Chef | + publish recipes |
| 10 | Moderator | + edit or remove reviews by users and chefs, ban/unban them (from a review or `/admin`) |
| 100 | Admin | + change privilege levels and delete accounts in `/admin` |

- Moderator and admin actions only work on accounts with a **lower** level, and never on your own account.
- Authors can always edit and delete their own recipes, whatever their level.
- Banned accounts are **read-only**: they can log in and browse, but can't publish, review, vote or edit.
- Level and ban status are re-read from the database on every request, so changes apply immediately.
- Rules live in `src/lib/privileges.ts` and are re-checked by every Server Action.

**Create the first admin** (sign up in the app first):

```bash
npm run set-level -- you@example.com 100
```

The same script works for recovery if no admin can log in.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` | Biome lint + format check |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests for validation and business rules (BR-1 to BR-12) |
| `npm run test:e2e` | Playwright: sign-up → create recipe → review → vote (uses the database in `.env` and removes its own test users) |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:studio` | Browse the database |
| `npm run seed:layout` | Add 15 dummy recipes for layout testing (`-- --remove` deletes them; photos display under `npm run dev` only) |
| `npm run set-level -- <email> <1\|2\|10\|100>` | Set an account's privilege level directly in the database |

First e2e run: `npx playwright install chromium`.

## Where things live

```
prisma/schema.prisma            data model; migration adds CHECK constraints (BR-2, BR-6)
src/auth.ts                     Auth.js config (credentials, JWT sessions, 30 days)
src/app/actions/                Server Actions — every write checks auth + permissions
src/lib/validation.ts           Zod schemas shared by forms and server
src/lib/rules.ts                permission / vote / review rules as pure functions
src/lib/data.ts                 read queries (browse, recipe, ratings, reviews)
src/app/api/upload/             Vercel Blob client-upload token endpoint
src/app/api/uploads/            development-only local upload fallback
tests/unit, tests/e2e           Vitest and Playwright
```

## Business rules → enforcement

| Rule | Where |
| --- | --- |
| BR-1 ≥1 image, BR-3 ≥1 ingredient and step | `recipeSchema` (server re-validates) |
| BR-2 cooking time > 0 | `recipeSchema` + `CHECK ("cookingMinutes" > 0)` |
| BR-4 all-or-nothing save | nested create / `$transaction` in `actions/recipes.ts` |
| BR-5 only the author edits/deletes | `canEditRecipe` in actions and pages |
| BR-6 rating 1–5 | `reviewSchema` + `CHECK ("rating" BETWEEN 1 AND 5)` |
| BR-7 one review per user per recipe | `@@unique([recipeId, userId])` |
| BR-8 no self-reviews | `canReviewRecipe` in `saveReview` |
| BR-9 all ratings count, only commented reviews listed | `getRatingSummary` / `getListedReviews` |
| BR-10 removing a comment clears its votes | `shouldClearVotes` in `saveReview` transaction |
| BR-11 one vote per user per review | `ReviewVote` primary key `(reviewId, userId)` |
| BR-12 no self-votes | `canVoteOnReview` in `voteOnReview` |

## Deploying to Vercel

1. Import the repo in Vercel (production branch `main`).
2. Create a Blob store in **Storage**, which adds `BLOB_READ_WRITE_TOKEN`; add `DATABASE_URL` and `AUTH_SECRET`.
3. Run migrations against production with `npm run db:migrate` (or add it to the build command).
4. Create the first admin with `npm run set-level` against the production database.

Self-hosting elsewhere (or `next start` locally) also needs `AUTH_TRUST_HOST=true`.

## Product decisions made during the build

- **Sign-up:** email + password (the PRD left this open). The Prisma adapter and its tables are in place, so OAuth providers can be added later.
- **Media storage:** Vercel Blob (the PRD said "CDN like Sanity"). Browsers upload directly to Blob, with progress shown.
- **Labels:** the PRD's draft list, stored as a Postgres enum. Changing the final list needs a migration.
- **Theme:** dark blue by default, with a toggle in the header. Guests' choice is kept in a `theme` cookie. Logged-in users' choice is saved on their account (`User.theme`) and read on every page load, so it follows them across devices. At login a saved account choice wins; if the account never chose one, the guest's choice is adopted.
- **Reordering** of images, ingredients and steps uses up/down buttons (keyboard-accessible) rather than drag and drop.
