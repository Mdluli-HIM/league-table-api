-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Venue_isActive_idx" ON "Venue"("isActive");
