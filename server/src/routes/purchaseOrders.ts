import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/", requireAuth, asyncHandler(async (_req, res) => {
  const purchaseOrders = await prisma.purchaseOrder.findMany({ orderBy: { poNumber: "asc" } });
  res.json(purchaseOrders);
}));

export default router;
