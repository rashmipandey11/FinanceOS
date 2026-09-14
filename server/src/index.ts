import "./lib/windowsCa";
import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import invoiceRoutes from "./routes/invoices";
import purchaseOrderRoutes from "./routes/purchaseOrders";
import dashboardRoutes from "./routes/dashboard";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Central error handler so unexpected failures (e.g. DB errors) return JSON
// instead of crashing the process or leaking a stack trace to the client.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`FinanceOS API listening on http://localhost:${port}`);
});
