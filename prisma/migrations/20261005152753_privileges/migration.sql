-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "moderatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "privilegeLevel" INTEGER NOT NULL DEFAULT 1;


-- Only the defined privilege levels are allowed
ALTER TABLE "User" ADD CONSTRAINT "User_privilegeLevel_valid" CHECK ("privilegeLevel" IN (1, 2, 10, 100));
