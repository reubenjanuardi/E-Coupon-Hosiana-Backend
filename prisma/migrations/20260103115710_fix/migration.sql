/*
  Warnings:

  - You are about to drop the `Gereja` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wilayah` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Gereja" DROP CONSTRAINT "Gereja_wilayahId_fkey";

-- DropForeignKey
ALTER TABLE "OrderCustomer" DROP CONSTRAINT "OrderCustomer_gerejaId_fkey";

-- DropForeignKey
ALTER TABLE "OrderCustomer" DROP CONSTRAINT "OrderCustomer_wilayahId_fkey";

-- DropTable
DROP TABLE "Gereja";

-- DropTable
DROP TABLE "Wilayah";

-- CreateTable
CREATE TABLE "wilayah_mupel" (
    "id" SERIAL NOT NULL,
    "nama_wilayah" TEXT NOT NULL,

    CONSTRAINT "wilayah_mupel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gereja" (
    "id" SERIAL NOT NULL,
    "nama_gereja" TEXT NOT NULL,
    "wilayahId" INTEGER NOT NULL,

    CONSTRAINT "gereja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wilayah_mupel_nama_wilayah_key" ON "wilayah_mupel"("nama_wilayah");

-- CreateIndex
CREATE UNIQUE INDEX "gereja_nama_gereja_wilayahId_key" ON "gereja"("nama_gereja", "wilayahId");

-- AddForeignKey
ALTER TABLE "OrderCustomer" ADD CONSTRAINT "OrderCustomer_wilayahId_fkey" FOREIGN KEY ("wilayahId") REFERENCES "wilayah_mupel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCustomer" ADD CONSTRAINT "OrderCustomer_gerejaId_fkey" FOREIGN KEY ("gerejaId") REFERENCES "gereja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gereja" ADD CONSTRAINT "gereja_wilayahId_fkey" FOREIGN KEY ("wilayahId") REFERENCES "wilayah_mupel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
