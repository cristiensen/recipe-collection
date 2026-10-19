-- Labels become rows (chefs and up can create them) instead of an enum.
-- The enum's name is needed for the table.
ALTER TYPE "Label" RENAME TO "Label_old";

-- Recipes keep their labels, now as slugs ({VEGAN,GLUTEN_FREE} becomes {vegan,gluten-free})
DROP INDEX "Recipe_labels_idx";
ALTER TABLE "Recipe" ALTER COLUMN "labels" TYPE TEXT[]
    USING replace(lower("labels"::text[]::text), '_', '-')::text[];
CREATE INDEX "Recipe_labels_idx" ON "Recipe" USING GIN ("labels");

DROP TYPE "Label_old";

CREATE TABLE "Label" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("slug")
);

CREATE INDEX "Label_createdById_idx" ON "Label"("createdById");

ALTER TABLE "Label" ADD CONSTRAINT "Label_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The former enum values, in their former order (labels are listed oldest first)
INSERT INTO "Label" ("slug", "name", "createdAt") VALUES
    ('vegan', 'Vegan', '2026-10-04 00:00:00'),
    ('vegetarian', 'Vegetarian', '2026-10-04 00:00:01'),
    ('gluten-free', 'Gluten-free', '2026-10-04 00:00:02'),
    ('dairy-free', 'Dairy-free', '2026-10-04 00:00:03'),
    ('spicy', 'Spicy', '2026-10-04 00:00:04'),
    ('dessert', 'Dessert', '2026-10-04 00:00:05'),
    ('breakfast', 'Breakfast', '2026-10-04 00:00:06'),
    ('quick', 'Quick', '2026-10-04 00:00:07');
