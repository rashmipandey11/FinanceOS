const TOKEN_KEY = "financeos_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response body wasn't JSON — keep the generic message
    }
    if (res.status === 401) clearToken();
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; email: string; role: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  listInvoices: () => request<Invoice[]>("/invoices"),
  getInvoice: (id: number) => request<Invoice>(`/invoices/${id}`),
  getInvoiceAudit: (id: number) => request<AuditEntry[]>(`/invoices/${id}/audit`),
  createInvoice: (input: { vendorName: string; poNumber: string | null; amount: number }) =>
    request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(input) }),
  retryAi: (id: number) => request<Invoice>(`/invoices/${id}/retry-ai`, { method: "POST" }),
  overrideInvoice: (id: number, decision: "approve" | "escalate" | "reject") =>
    request<Invoice>(`/invoices/${id}/override`, {
      method: "PATCH",
      body: JSON.stringify({ decision }),
    }),

  listPurchaseOrders: () => request<PurchaseOrder[]>("/purchase-orders"),
  dashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
};

export interface DiscrepancyFlag {
  code: string;
  message: string;
}

export interface Invoice {
  id: number;
  vendorName: string;
  poNumber: string | null;
  amount: number;
  exceptionFlags: DiscrepancyFlag[];
  status: "pending" | "approve" | "escalate" | "reject";
  aiRecommendation: "approve" | "escalate" | "reject" | null;
  aiRationale: string | null;
  aiFallback: boolean;
  humanOverride: "approve" | "escalate" | "reject" | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: number;
  userId: number | null;
  entityType: string;
  entityId: number;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: string;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  approvedAmount: number;
  costCentre: string;
  status: string;
}

export interface DashboardSummary {
  totalInvoices: number;
  exceptionCount: number;
  exceptionRate: number;
  resolvedCount: number;
  overrideCount: number;
  overrideRate: number;
  avgResolutionMinutes: number | null;
  statusBreakdown: Record<string, number>;
}
