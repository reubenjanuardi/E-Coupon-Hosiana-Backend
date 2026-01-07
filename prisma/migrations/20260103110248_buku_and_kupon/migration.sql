-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending_payment', 'pending_verification', 'verified', 'cancelled');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('valid', 'claimed', 'void');

-- CreateEnum
CREATE TYPE "AsalPembeli" AS ENUM ('GPIB', 'UMUM');

-- CreateTable
CREATE TABLE "Order" (
    "orderId" VARCHAR(64) NOT NULL,
    "bookCount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "OrderCustomer" (
    "orderId" VARCHAR(64) NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "nomorWhatsApp" TEXT NOT NULL,
    "asalPembeli" "AsalPembeli" NOT NULL,
    "wilayahMupel" TEXT NOT NULL,
    "gereja" TEXT NOT NULL,

    CONSTRAINT "OrderCustomer_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "PaymentEvidence" (
    "id" UUID NOT NULL,
    "orderId" VARCHAR(64) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponBook" (
    "bookCode" VARCHAR(64) NOT NULL,
    "orderId" VARCHAR(64) NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponBook_pkey" PRIMARY KEY ("bookCode")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "couponCode" VARCHAR(64) NOT NULL,
    "bookCode" VARCHAR(64) NOT NULL,
    "status" "CouponStatus" NOT NULL,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("couponCode")
);

-- AddForeignKey
ALTER TABLE "OrderCustomer" ADD CONSTRAINT "OrderCustomer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvidence" ADD CONSTRAINT "PaymentEvidence_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponBook" ADD CONSTRAINT "CouponBook_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_bookCode_fkey" FOREIGN KEY ("bookCode") REFERENCES "CouponBook"("bookCode") ON DELETE RESTRICT ON UPDATE CASCADE;
