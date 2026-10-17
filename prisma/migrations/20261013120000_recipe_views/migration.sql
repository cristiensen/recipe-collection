-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RecipeViewDay" (
    "recipeId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeViewDay_pkey" PRIMARY KEY ("recipeId","day")
);

-- CreateIndex
CREATE INDEX "RecipeViewDay_day_idx" ON "RecipeViewDay"("day");

-- CreateIndex
CREATE INDEX "RecipeLike_createdAt_idx" ON "RecipeLike"("createdAt");

-- AddForeignKey
ALTER TABLE "RecipeViewDay" ADD CONSTRAINT "RecipeViewDay_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
