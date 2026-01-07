// Payments Controller
// Handles payment evidence uploads
import axios from "axios";
import { prisma } from "../db/prisma.js";
import { generateDynamicQris } from "../utils/qris.js";
import multer from "multer";

const QRIS_STATIC = process.env.QRIS_STATIC;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/heic", "image/heif"]; // allow common mobile formats

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format file tidak didukung"));
    }
  },
});

export const uploadEvidenceMiddleware = upload.single("file");

export async function getQris(req, res) {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: "orderId wajib" });
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
      select: {
        payabyleAmount: true,
        totalAmount: true,
        uniqueCode: true,
        status: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order tidak ditemukan" });
    }

    if (order.status !== "pending_payment") {
      return res.status(400).json({ message: "Order sudah tidak dapat dibayar" });
    }

    const payableAmount = order.payabyleAmount ?? order.totalAmount + (order.uniqueCode ?? 0);

    if (!QRIS_STATIC) {
      return res.status(500).json({ message: "QRIS static belum dikonfigurasi" });
    }

    const qrisPayload = generateDynamicQris(QRIS_STATIC, Number(payableAmount));

    return res.json({
      qrisPayload,
      amount: payableAmount,
      baseAmount: order.totalAmount,
      uniqueCode: order.uniqueCode,
    });
  } catch (error) {
    console.error("QRIS error:", error);
    return res.status(500).json({
      message: error.message || "Gagal generate QRIS",
    });
  }
}

export async function uploadPaymentEvidence(req, res) {
  try {
    const { orderId } = req.body;
    const file = req.file;

    if (!orderId) {
      return res.status(400).json({ message: "orderId wajib" });
    }

    if (!file) {
      return res.status(400).json({ message: "File bukti bayar wajib diunggah" });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ message: "Format file tidak didukung" });
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
      select: { status: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order tidak ditemukan" });
    }

    if (order.status === "verified") {
      return res.status(400).json({ message: "Order sudah terverifikasi" });
    }

    if (order.status !== "pending_payment") {
      return res.status(400).json({ message: "Order tidak dalam status menunggu pembayaran" });
    }

    const existingEvidence = await prisma.paymentEvidence.findUnique({
      where: { orderId },
      select: { id: true },
    });

    if (existingEvidence) {
      return res.status(400).json({ message: "Bukti pembayaran sudah diunggah" });
    }

    // Upload to GAS endpoint (expects JSON in POST body)
    const base64 = file.buffer.toString("base64");
    const gasPayload = {
      base64Data: base64,
      mimeType: file.mimetype,
      fileName: `${orderId}_${file.originalname}`,
      orderId,
    };

    let driveUrl;
    const timeoutMs = Number(process.env.GAS_TIMEOUT_MS || 300000);
    const axiosConfig = {
      timeout: timeoutMs,
      headers: { "Content-Type": "application/json" },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const gasRes = await axios.post(process.env.GAS_ENDPOINT, gasPayload, axiosConfig);
        const data = gasRes.data || {};
        if (data.status !== "success" || !data.fileUrl) {
          console.error("GAS upload returned error", { orderId, response: data });
          return res.status(502).json({ message: "Gagal mengunggah bukti pembayaran" });
        }
        driveUrl = data.fileUrl;
        break;
      } catch (err) {
        const isTransient = err.code === "ECONNABORTED" || err.message?.includes("timeout") || err.code === "ECONNRESET";
        console.error("GAS upload failed", { orderId, attempt, error: err.message });
        if (attempt < 3 && isTransient) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }
        return res.status(502).json({ message: "Gagal mengunggah ke penyimpanan" });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentEvidence.create({
        data: {
          orderId,
          fileUrl: driveUrl,
        },
      });

      await tx.order.update({
        where: { orderId },
        data: { status: "pending_verification" },
      });
    });

    return res.json({ success: true, driveUrl });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Ukuran file maksimal 10MB" });
    }

    console.error("uploadPaymentEvidence error", err);
    return res.status(400).json({ message: err.message || "Gagal mengunggah bukti pembayaran" });
  }
}
