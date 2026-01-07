/*
  Warnings:

  - Added the required column `payabyleAmount` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uniqueCode` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CouponBook" ADD COLUMN     "lockExpiresAt" TIMESTAMP(3),
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "payabyleAmount" INTEGER NOT NULL,
ADD COLUMN     "uniqueCode" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "CouponBook_lockedBy_idx" ON "CouponBook"("lockedBy");

-- CreateIndex
CREATE INDEX "CouponBook_lockExpiresAt_idx" ON "CouponBook"("lockExpiresAt");
