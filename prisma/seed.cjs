const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TOTAL_BOOKS = 3500;
const COUPONS_PER_BOOK = 10;

function pad(num, size = 5) {
  return String(num).padStart(size, '0');
}

async function main() {
  console.log('🌱 Seeding CouponBooks...');

  const books = [];
  for (let i = 1; i <= TOTAL_BOOKS; i++) {
    books.push({
      bookCode: `BUKU-${pad(i, 4)}`
    });
  }

  await prisma.couponBook.createMany({
    data: books,
    skipDuplicates: true
  });

  console.log('🌱 Seeding Coupons...');

  const coupons = [];
  let couponNumber = 1;

  for (let book = 1; book <= TOTAL_BOOKS; book++) {
    const bookCode = `BUKU-${pad(book, 4)}`;

    for (let i = 0; i < COUPONS_PER_BOOK; i++) {
      coupons.push({
        couponCode: `KPN-${pad(couponNumber)}`,
        bookCode,
        status: 'valid'
      });
      couponNumber++;
    }
  }

  await prisma.coupon.createMany({
    data: coupons,
    skipDuplicates: true
  });

  console.log('✅ Seed selesai');
}

main()
  .catch((e) => {
    console.error('❌ Seed error', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
