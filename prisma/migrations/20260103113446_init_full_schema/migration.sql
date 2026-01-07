/*
  Warnings:

  - You are about to drop the column `gereja` on the `OrderCustomer` table. All the data in the column will be lost.
  - You are about to drop the column `wilayahMupel` on the `OrderCustomer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[orderId]` on the table `PaymentEvidence` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "CouponBook" DROP CONSTRAINT "CouponBook_orderId_fkey";

-- AlterTable
ALTER TABLE "Coupon" ALTER COLUMN "status" SET DEFAULT 'valid';

-- AlterTable
ALTER TABLE "CouponBook" ALTER COLUMN "orderId" DROP NOT NULL,
ALTER COLUMN "assignedAt" DROP NOT NULL,
ALTER COLUMN "assignedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'pending_payment';

-- AlterTable
ALTER TABLE "OrderCustomer" DROP COLUMN "gereja",
DROP COLUMN "wilayahMupel",
ADD COLUMN     "gerejaId" INTEGER,
ADD COLUMN     "wilayahId" INTEGER;

-- CreateTable
CREATE TABLE "Wilayah" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,

    CONSTRAINT "Wilayah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gereja" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "wilayahId" INTEGER NOT NULL,

    CONSTRAINT "Gereja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wilayah_nama_key" ON "Wilayah"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "Gereja_nama_wilayahId_key" ON "Gereja"("nama", "wilayahId");

-- CreateIndex
CREATE INDEX "Coupon_status_idx" ON "Coupon"("status");

-- CreateIndex
CREATE INDEX "CouponBook_orderId_idx" ON "CouponBook"("orderId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvidence_orderId_key" ON "PaymentEvidence"("orderId");

-- AddForeignKey
ALTER TABLE "OrderCustomer" ADD CONSTRAINT "OrderCustomer_wilayahId_fkey" FOREIGN KEY ("wilayahId") REFERENCES "Wilayah"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCustomer" ADD CONSTRAINT "OrderCustomer_gerejaId_fkey" FOREIGN KEY ("gerejaId") REFERENCES "Gereja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponBook" ADD CONSTRAINT "CouponBook_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gereja" ADD CONSTRAINT "Gereja_wilayahId_fkey" FOREIGN KEY ("wilayahId") REFERENCES "Wilayah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
