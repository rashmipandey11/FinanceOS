import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthedRequest, requireAuth } from "../middleware/auth";
import { matchInvoice } from "../services/matching";
import { generateTriageRecommendation } from "../services/llmTriage";
import { logAudit } from "../services/auditLog";
import { asyncHandler } from "../lib/asyncHandler";

const router = Router();

const CreateInvoiceSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  poNumber: z.string().trim().min(1).nullable().optional(),
  amount: z.number().positive("Amount must be greater than zero"),
});

const OverrideSchema = z.object({
  decision: z.enum(["approve", "escalate", "reject"]),
  note: z.string().optional(),
});

function serializeInvoice(invoice: any) {
  return {
    ...invoice,
    exceptionFlags: JSON.parse(invoice.exceptionFlags || "[]"),
  };
}

router.get(
  "/",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" } });
    res.json(invoices.map(serializeInvoice));
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(serializeInvoice(invoice));
  })
);

router.get(
  "/:id/audit",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const entries = await prisma.auditLog.findMany({
      where: { entityType: "invoice", entityId: id },
      orderBy: { timestamp: "asc" },
    });
    res.json(
      entries.map((entry) => ({
        ...entry,
        oldValue: entry.oldValue ? JSON.parse(entry.oldValue) : null,
        newValue: entry.newValue ? JSON.parse(entry.newValue) : null,
      }))
    );
  })
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = CreateInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid invoice payload" });
    }

    const { vendorName, amount } = parsed.data;
    const poNumber = parsed.data.poNumber || null;

    const match = await matchInvoice({ vendorName, poNumber, amount });
    const triage = await generateTriageRecommendation({ vendorName, poNumber, amount }, match);

    const invoice = await prisma.invoice.create({
      data: {
        vendorName,
        poNumber,
        amount,
        exceptionFlags: JSON.stringify(match.flags),
        status: "pending",
        aiRecommendation: triage.recommendation,
        aiRationale: triage.rationale,
        aiFallback: triage.fallback,
      },
    });

    await logAudit({
      userId: req.user?.id,
      entityType: "invoice",
      entityId: invoice.id,
      action: "ai_triage",
      newValue: { recommendation: triage.recommendation, rationale: triage.rationale, fallback: triage.fallback },
    });

    res.status(201).json(serializeInvoice(invoice));
  })
);

router.post(
  "/:id/retry-ai",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const match = await matchInvoice({
      vendorName: invoice.vendorName,
      poNumber: invoice.poNumber,
      amount: invoice.amount,
      excludeInvoiceId: invoice.id,
    });
    const triage = await generateTriageRecommendation(
      { vendorName: invoice.vendorName, poNumber: invoice.poNumber, amount: invoice.amount },
      match
    );

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        exceptionFlags: JSON.stringify(match.flags),
        aiRecommendation: triage.recommendation,
        aiRationale: triage.rationale,
        aiFallback: triage.fallback,
      },
    });

    await logAudit({
      userId: req.user?.id,
      entityType: "invoice",
      entityId: id,
      action: "ai_triage_retry",
      oldValue: { recommendation: invoice.aiRecommendation, fallback: invoice.aiFallback },
      newValue: { recommendation: triage.recommendation, rationale: triage.rationale, fallback: triage.fallback },
    });

    res.json(serializeInvoice(updated));
  })
);

router.patch(
  "/:id/override",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const parsed = OverrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "decision must be one of approve, escalate, reject" });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const { decision } = parsed.data;
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        humanOverride: decision,
        status: decision,
        resolvedAt: new Date(),
      },
    });

    await logAudit({
      userId: req.user?.id,
      entityType: "invoice",
      entityId: id,
      action: decision === invoice.aiRecommendation ? "human_confirm" : "human_override",
      oldValue: { aiRecommendation: invoice.aiRecommendation },
      newValue: { humanOverride: decision },
    });

    res.json(serializeInvoice(updated));
  })
);

export default router;
