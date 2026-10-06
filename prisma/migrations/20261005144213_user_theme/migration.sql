-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('DARK', 'LIGHT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "theme" "ThemePreference";

