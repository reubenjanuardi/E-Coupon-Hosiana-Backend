// Verification Controller
// Handles coupon code verification

export async function verifyCoupon(req, res) {
  const coupon = await prisma.coupon.findUnique({
      where: { couponCode: req.params.couponCode },
      include: {
        couponBook: {
          include: {
            order: {
              include: { customer: true }
            }
          }
        }
      }
    });
  // TODO: Implement coupon verification logic using Prisma
   if (!coupon) {
    return res.status(404).json({ valid: false });
  }

  const customer = coupon.couponBook.order.customer;

  res.json({
    couponCode: coupon.couponCode,
    status: coupon.status,
    owner: customer.namaLengkap.slice(0, 3) + "***",
    whatsapp: customer.nomorWhatsApp.slice(0, 4) + "****"
  });
}
