# Recipe Collection

Home cooks publish recipes with photos and video; other cooks rate, review and vote on reviews.
Built from the *Recipe Sharing Platform — Product Requirements (MVP)*.

**Stack:** Next.js 16 (App Router, Server Actions) · PostgreSQL via Prisma 7 · Auth.js (email + password, Prisma adapter) · Vercel Blob · Zod · Tailwind CSS + shadcn/ui · Vitest · Playwright

## Getting started

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and AUTH_SECRET (npx auth secret)
npm run db:local            # start a local database; put its TCP URL in DATABASE_URL
npx prisma migrate deploy   # create the tables
npm run dev                 # http://localhost:3000
```

**Develop and test against a local database, not the hosted one.** Hosted Prisma Postgres bills every query, and `next dev` re-runs a page's queries on every save, as does each e2e run across hundreds of page loads. `npm run db:local` runs a free local Prisma Postgres (`prisma dev`) in the background and prints its `postgres://…@localhost…` TCP URL; after a reboot, `npx prisma dev start recipe-collection` starts it again. Keep the hosted `DATABASE_URL` in Vercel's environment variables only.

Without `BLOB_STORE_ID`, uploads in development go to `./.uploads` and are served from `/api/uploads/*`.
Production requires Vercel Blob; the local fallback is disabled there.
To upload to Blob locally, run `npx vercel link` and `npx vercel env pull .env.local`; the pulled `VERCEL_OIDC_TOKEN` expires after about 12 hours, so pull again when uploads start failing. `npm run check:blob` tests the credentials without uploading anything.

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
- Level and ban status come from the database, not the session cookie, so changes made in the app apply immediately. In production the account is cached between requests and invalidated by those changes; `npm run set-level` (which edits the database directly) shows within 5 minutes.
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
| `npm run test:e2e` | Playwright: sign-up → create recipe → review → vote (uses the database in `.env`, which should be the local one, and removes its own test users) |
| `npm run db:local` | Start a local Prisma Postgres for development and tests (`prisma dev`) |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:studio` | Browse the database |
| `npm run seed:layout` | Add 15 dummy recipes for layout testing (`-- --remove` deletes them; photos display under `npm run dev` only) |
| `npm run seed:demo` | Add 40 realistic demo recipes with photos (on Vercel Blob), reviews and likes (`-- --remove` deletes them) |
| `npm run set-level -- <email> <1\|2\|10\|100>` | Set an account's privilege level directly in the database |
| `npm run set-password -- <email>` | Set a new password for an account (asks for it without echoing; there is no reset email) |

First e2e run: `npx playwright install chromium`.

## Where things live

```
prisma/schema.prisma            data model; migration adds CHECK constraints (BR-2, BR-6)
src/auth.ts                     Auth.js config (credentials, JWT sessions, 30 days)
src/app/actions/                Server Actions — every write checks auth + permissions
src/lib/validation.ts           Zod schemas shared by forms and server
src/lib/rules.ts                permission / vote / review rules as pure functions
src/lib/data.ts                 read queries (browse, trending, recipe, ratings, reviews)
src/lib/views.ts                view counting and the weekly cleanup
src/lib/cache.ts                cross-request caching (production only) and its invalidation
src/app/api/recipes/[id]/view/  records a view (called by the ViewBeacon component)
src/app/api/cron/prune-views/   daily cleanup, scheduled in vercel.json
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
2. Create a **public** Blob store in **Storage** and connect it to the project, which adds `BLOB_STORE_ID` and `BLOB_WEBHOOK_PUBLIC_KEY` (the app authenticates with Vercel OIDC, no read-write token); add `DATABASE_URL`, `AUTH_SECRET` and `CRON_SECRET` (any long random string; it lets Vercel Cron run the daily view-count cleanup).
3. Run migrations against production with `npm run db:migrate` (or add it to the build command).
4. Create the first admin with `npm run set-level` against the production database.

Self-hosting elsewhere (or `next start` locally) also needs `AUTH_TRUST_HOST=true`.

## Views and trending

- A view is counted when a recipe page opens in a browser (`ViewBeacon` posts to `/api/recipes/[id]/view`), so link prefetches and crawlers that don't run scripts never count.
- Known bots, the recipe's own author and repeat visits from the same browser within 24 hours (a cookie scoped to that endpoint) are ignored.
- Each view adds to `Recipe.viewCount` (all time) and to that day's `RecipeViewDay` row. Days are UTC.
- `mostViewedList` and `getMostLikedThisWeek` in `src/lib/data.ts` rank recipes over the last 7 days and respect private profiles.
- For guests the "Hottest" row is cached for up to 5 minutes in production, so new views can take that long to reorder it.

## Rows above the browse feed

- Horizontally scrolling rows sit between the filters and the results. Each is a `RecipeRow` (`src/components/recipe-row.tsx`) fed by a query in `src/lib/data.ts` that returns up to `ROW_SIZE` (15) cards.
- Rows follow the label, cooking-time and rating filters but not the sort, and are left out when empty. Row queries reuse the feed's filtering by passing a join to `feedQuery`.
- **What you love** (logged-in users): their liked recipes, most recently liked first (`lovedList`).
- `getBrowseLists` loads the feed, its total and every row in one SQL query. Guests all see the same lists, so theirs are cached in production until a recipe, like, review or profile visibility changes (`recipesChanged` in `src/lib/cache.ts`).
- Daily counts older than 7 days are deleted by a Vercel Cron job (03:00 UTC). Likes are never deleted.

## Product decisions made during the build

- **Sign-up:** email + password (the PRD left this open). The Prisma adapter and its tables are in place, so OAuth providers can be added later.
- **Media storage:** Vercel Blob (the PRD said "CDN like Sanity"). Browsers upload directly to Blob, with progress shown.
- **Labels:** the PRD's draft list, stored as a Postgres enum. Changing the final list needs a migration.
- **Theme:** dark blue by default, with a toggle in the header. Guests' choice is kept in a `theme` cookie. Logged-in users' choice is saved on their account (`User.theme`) and read on every page load, so it follows them across devices. At login a saved account choice wins; if the account never chose one, the guest's choice is adopted.
- **Reordering** of images, ingredients and steps uses up/down buttons (keyboard-accessible) rather than drag and drop.
