/*
  Warnings:

  - You are about to drop the column `wilayahId` on the `gereja` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nama_gereja,wilayah_id]` on the table `gereja` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `wilayah_id` to the `gereja` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "gereja" DROP CONSTRAINT "gereja_wilayahId_fkey";

-- DropIndex
DROP INDEX "gereja_nama_gereja_wilayahId_key";

-- AlterTable
ALTER TABLE "gereja" DROP COLUMN "wilayahId",
ADD COLUMN     "wilayah_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "gereja_nama_gereja_wilayah_id_key" ON "gereja"("nama_gereja", "wilayah_id");

-- AddForeignKey
ALTER TABLE "gereja" ADD CONSTRAINT "gereja_wilayah_id_fkey" FOREIGN KEY ("wilayah_id") REFERENCES "wilayah_mupel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
