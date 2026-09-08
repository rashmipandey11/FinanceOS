import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

router.get("/summary", requireAuth, asyncHandler(async (_req, res) => {
  const invoices = await prisma.invoice.findMany();

  const totalInvoices = invoices.length;
  const exceptionInvoices = invoices.filter((inv) => JSON.parse(inv.exceptionFlags || "[]").length > 0);
  const resolved = invoices.filter((inv) => inv.humanOverride && inv.resolvedAt);
  const overridden = resolved.filter((inv) => inv.humanOverride !== inv.aiRecommendation);

  const avgResolutionMinutes =
    resolved.length > 0
      ? resolved.reduce((sum, inv) => {
          const minutes = (inv.resolvedAt!.getTime() - inv.createdAt.getTime()) / 60000;
          return sum + minutes;
        }, 0) / resolved.length
      : null;

  const statusBreakdown = invoices.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, {});

  res.json({
    totalInvoices,
    exceptionCount: exceptionInvoices.length,
    exceptionRate: totalInvoices > 0 ? exceptionInvoices.length / totalInvoices : 0,
    resolvedCount: resolved.length,
    overrideCount: overridden.length,
    overrideRate: resolved.length > 0 ? overridden.length / resolved.length : 0,
    avgResolutionMinutes,
    statusBreakdown,
  });
}));

export default router;
