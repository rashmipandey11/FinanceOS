import { prisma } from "../lib/prisma";

export type Recommendation = "approve" | "escalate" | "reject";

export interface DiscrepancyFlag {
  code:
    | "missing_po_reference"
    | "po_not_found"
    | "unrecognised_vendor"
    | "po_closed"
    | "duplicate_invoice"
    | "over_po_amount"
    | "under_po_amount";
  message: string;
}

export interface MatchResult {
  flags: DiscrepancyFlag[];
  suggestedRecommendation: Recommendation;
  purchaseOrder: {
    poNumber: string;
    vendorName: string;
    approvedAmount: number;
    costCentre: string;
    status: string;
  } | null;
}

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

/**
 * Deterministic fact-finding: this is the source of truth for discrepancies.
 * The LLM is only asked to reason about the flags produced here, never to
 * compute amounts or decide whether a PO exists.
 */
export async function matchInvoice(input: {
  vendorName: string;
  poNumber: string | null;
  amount: number;
  excludeInvoiceId?: number;
}): Promise<MatchResult> {
  const flags: DiscrepancyFlag[] = [];
  const poNumber = input.poNumber?.trim() || null;

  const vendor = await prisma.vendor.findFirst({
    where: { name: { equals: input.vendorName.trim() } },
  });
  if (!vendor) {
    flags.push({
      code: "unrecognised_vendor",
      message: `"${input.vendorName}" is not in the known vendor list.`,
    });
  }

  if (!poNumber || normalize(poNumber) === "none") {
    flags.push({
      code: "missing_po_reference",
      message: "No PO number was provided on this invoice.",
    });
  }

  let po = null;
  if (poNumber && normalize(poNumber) !== "none") {
    po = await prisma.purchaseOrder.findUnique({ where: { poNumber } });
    if (!po) {
      flags.push({
        code: "po_not_found",
        message: `PO ${poNumber} does not exist in the PO register.`,
      });
    }
  }

  if (po?.status === "Closed") {
    flags.push({
      code: "po_closed",
      message: `PO ${po.poNumber} is closed and cannot accept new invoices.`,
    });
  }

  if (po) {
    const delta = input.amount - po.approvedAmount;
    if (delta > 0.005) {
      flags.push({
        code: "over_po_amount",
        message: `Invoice exceeds the approved PO amount by $${delta.toFixed(2)}.`,
      });
    } else if (delta < -0.005) {
      flags.push({
        code: "under_po_amount",
        message: `Invoice is $${Math.abs(delta).toFixed(2)} under the approved PO amount (partial invoice).`,
      });
    }
  }

  const duplicates = await prisma.invoice.findMany({
    where: {
      vendorName: input.vendorName.trim(),
      poNumber: poNumber ?? undefined,
      amount: input.amount,
      ...(input.excludeInvoiceId ? { id: { not: input.excludeInvoiceId } } : {}),
    },
    take: 1,
  });
  if (poNumber && duplicates.length > 0) {
    flags.push({
      code: "duplicate_invoice",
      message: `Same vendor, PO, and amount already submitted (invoice #${duplicates[0].id}).`,
    });
  }

  const hasCode = (code: DiscrepancyFlag["code"]) => flags.some((f) => f.code === code);

  let suggestedRecommendation: Recommendation = "approve";
  if (hasCode("po_not_found") || hasCode("unrecognised_vendor") || hasCode("po_closed")) {
    suggestedRecommendation = "reject";
  } else if (
    hasCode("duplicate_invoice") ||
    hasCode("over_po_amount") ||
    hasCode("missing_po_reference")
  ) {
    suggestedRecommendation = "escalate";
  }

  return {
    flags,
    suggestedRecommendation,
    purchaseOrder: po
      ? {
          poNumber: po.poNumber,
          vendorName: po.vendorName,
          approvedAmount: po.approvedAmount,
          costCentre: po.costCentre,
          status: po.status,
        }
      : null,
  };
}
