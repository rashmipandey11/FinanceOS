import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { DiscrepancyFlag, MatchResult, Recommendation } from "./matching";

const TriageOutputSchema = z.object({
  recommendation: z.enum(["approve", "escalate", "reject"]),
  rationale: z.string().min(1),
});

export interface TriageResult {
  recommendation: Recommendation;
  rationale: string;
  fallback: boolean;
}

const PROMPT_PATH = path.join(__dirname, "../../../prompts/invoice_triage.md");
const CALL_TIMEOUT_MS = 10_000;

let cachedTemplate: { system: string; userTemplate: string } | null = null;

function loadPromptTemplate(): { system: string; userTemplate: string } {
  if (cachedTemplate) return cachedTemplate;

  const raw = fs.readFileSync(PROMPT_PATH, "utf-8");
  const systemMatch = raw.match(/## System\s*\n([\s\S]*?)\n## User Template/);
  const userMatch = raw.match(/## User Template\s*\n([\s\S]*)$/);

  if (!systemMatch || !userMatch) {
    throw new Error(`Could not parse prompt sections from ${PROMPT_PATH}`);
  }

  cachedTemplate = { system: systemMatch[1].trim(), userTemplate: userMatch[1].trim() };
  return cachedTemplate;
}

function renderUserMessage(
  template: string,
  invoice: { vendorName: string; poNumber: string | null; amount: number },
  match: MatchResult
): string {
  const poDetails = match.purchaseOrder
    ? `- PO ${match.purchaseOrder.poNumber}: vendor "${match.purchaseOrder.vendorName}", approved amount $${match.purchaseOrder.approvedAmount}, cost centre ${match.purchaseOrder.costCentre}, status ${match.purchaseOrder.status}`
    : "- No matching PO found in the register.";

  const flagLines =
    match.flags.length > 0
      ? match.flags.map((f: DiscrepancyFlag) => `- [${f.code}] ${f.message}`).join("\n")
      : "- None. Invoice matches the PO within tolerance.";

  return template
    .replace("{{vendor_name}}", invoice.vendorName)
    .replace("{{po_number}}", invoice.poNumber || "(none provided)")
    .replace("{{amount}}", invoice.amount.toFixed(2))
    .replace("{{po_details}}", poDetails)
    .replace("{{discrepancy_flags}}", flagLines);
}

function ruleBasedFallback(match: MatchResult): TriageResult {
  const summary =
    match.flags.length > 0
      ? match.flags.map((f) => f.message).join(" ")
      : "Invoice matches the PO within tolerance.";
  return {
    recommendation: match.suggestedRecommendation,
    rationale: `AI unavailable — showing rule-based suggestion pending review. ${summary}`,
    fallback: true,
  };
}

async function callClaudeOnce(system: string, userMessage: string, signal: AbortSignal) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  const response = await client.messages.create(
    {
      model,
      max_tokens: 300,
      temperature: 0,
      system,
      messages: [{ role: "user", content: userMessage }],
    },
    { signal }
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude response did not contain a JSON object");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return TriageOutputSchema.parse(parsed);
}

export async function generateTriageRecommendation(
  invoice: { vendorName: string; poNumber: string | null; amount: number },
  match: MatchResult
): Promise<TriageResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return ruleBasedFallback(match);
  }

  const { system, userTemplate } = loadPromptTemplate();
  const userMessage = renderUserMessage(userTemplate, invoice, match);

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
    try {
      const result = await callClaudeOnce(system, userMessage, controller.signal);
      clearTimeout(timeout);
      return { ...result, fallback: false };
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === 1) {
        console.error("LLM triage failed after retry, falling back to rule-based suggestion:", err);
        return ruleBasedFallback(match);
      }
    }
  }

  return ruleBasedFallback(match);
}
