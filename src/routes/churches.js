import express from "express";
import {
  getAllWilayah,
  getGerejaByWilayah
} from "../controllers/churches.controller.js";

const router = express.Router();

// Public endpoints (tanpa auth)
router.get("/wilayah", getAllWilayah);
router.get("/wilayah/:wilayahId/gereja", getGerejaByWilayah);

export default router;
