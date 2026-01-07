// validators.js
// TODO: Implement request validation logic for each endpoint
// Use this file to define reusable validation functions
export function validateCreateOrder(req, res, next) {
  const { selectedBooks, customer } = req.body;

  // ======================
  // selectedBooks
  // ======================
  if (!Array.isArray(selectedBooks)) {
    return res.status(400).json({
      message: "selectedBooks harus berupa array",
    });
  }

  if (selectedBooks.length === 0) {
    return res.status(400).json({
      message: "Minimal pilih 1 buku",
    });
  }

  const invalidBook = selectedBooks.find(
    (b) => typeof b !== "string" || !b.startsWith("BUKU-")
  );

  if (invalidBook) {
    return res.status(400).json({
      message: "Format kode buku tidak valid",
    });
  }

  // ======================
  // customer
  // ======================
  if (!customer) {
    return res.status(400).json({ message: "Data customer wajib diisi" });
  }

  const { namaLengkap, nomorWhatsApp, asalPembeli } = customer;

  if (!namaLengkap || typeof namaLengkap !== "string") {
    return res.status(400).json({ message: "Nama lengkap tidak valid" });
  }

  if (!nomorWhatsApp || !/^[0-9]{9,15}$/.test(nomorWhatsApp)) {
    return res.status(400).json({ message: "Nomor WhatsApp tidak valid" });
  }

  if (!["GPIB", "UMUM"].includes(asalPembeli)) {
    return res.status(400).json({ message: "Asal pembeli tidak valid" });
  }

  // ======================
  // Conditional GPIB
  // ======================
  if (asalPembeli === "GPIB") {
    if (!customer.wilayahId || !customer.gerejaId) {
      return res.status(400).json({
        message: "Wilayah dan gereja wajib diisi untuk pembeli GPIB",
      });
    }
  }

  next();
}

export function validateUploadEvidence(body) {
  if (!body.orderId) {
    throw new Error("orderId wajib");
  }

  if (!body.fileBase64) {
    throw new Error("File bukti bayar wajib");
  }
}
