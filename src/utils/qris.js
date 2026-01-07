// src/utils/qris.js

/**
 * Generate QRIS dinamis dari QRIS statis + nominal
 * @param {string} qrisStatic - QRIS static string
 * @param {number} amount - nominal pembayaran
 * @returns {string} QRIS payload dinamis
 */
export function generateDynamicQris(qrisStatic, amount) {
  if (!qrisStatic || !amount || amount <= 0) {
    throw new Error("QRIS static atau amount tidak valid");
  }

  // 1️⃣ Switch static → dynamic (010211 → 010212)
  let q = qrisStatic.slice(0, -4).replace("010211", "010212");

  // 2️⃣ Split sebelum country code
  const parts = q.split("5802ID");
  if (parts.length !== 2) {
    throw new Error("Format QRIS tidak valid");
  }

  // 3️⃣ Inject amount (tag 54)
  const amountStr = String(amount);
  q =
    parts[0] +
    "54" +
    pad2(amountStr.length) +
    amountStr +
    "5802ID" +
    parts[1];

  // 4️⃣ Append CRC
  return q + crc16(q);
}

/**
 * CRC16 CCITT
 */
function crc16(input) {
  let crc = 0xffff;

  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Pad length to 2 digits
 */
function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}
