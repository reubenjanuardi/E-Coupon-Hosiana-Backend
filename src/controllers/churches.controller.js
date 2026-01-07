import { prisma } from "../db/prisma.js";

/**
 * GET /public/wilayah
 * Ambil semua wilayah mupel
 */
export async function getAllWilayah(req, res) {
  try {
    const wilayah_mupel = await prisma.wilayah_mupel.findMany({
      orderBy: { id: "asc" }
    });

    res.json(wilayah_mupel);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * GET /public/wilayah/:wilayahId/gereja
 * Ambil gereja berdasarkan wilayah
 */
export async function getGerejaByWilayah(req, res) {
  try {
    const wilayah_id = Number(req.params.wilayahId);

    if (isNaN(wilayah_id)) {
      return res.status(400).json({ message: "Invalid wilayahId" });
    }

    const gereja = await prisma.gereja.findMany({
      where: { wilayah_id },
      orderBy: { id: "asc" }
    });

    res.json(gereja);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
