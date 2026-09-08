import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Appendix A1 — Purchase Order Register
const purchaseOrders = [
  { poNumber: "PO-2024-001", vendorName: "Acme Consulting Ltd", approvedAmount: 45000, costCentre: "IT-Operations", status: "Open" },
  { poNumber: "PO-2024-002", vendorName: "Global Print Co", approvedAmount: 3200, costCentre: "Marketing", status: "Open" },
  { poNumber: "PO-2024-003", vendorName: "FastCloud Infra", approvedAmount: 12800, costCentre: "IT-Infrastructure", status: "Open" },
  { poNumber: "PO-2024-004", vendorName: "Meridian Legal", approvedAmount: 28500, costCentre: "Legal", status: "Open" },
  { poNumber: "PO-2024-005", vendorName: "Acme Consulting Ltd", approvedAmount: 18000, costCentre: "Finance", status: "Closed" },
  { poNumber: "PO-2024-006", vendorName: "OfficeHub Supplies", approvedAmount: 1450, costCentre: "Admin", status: "Open" },
  { poNumber: "PO-2024-007", vendorName: "TechForce Recruitment", approvedAmount: 67000, costCentre: "HR", status: "Open" },
  { poNumber: "PO-2024-008", vendorName: "BlueSky Travel", approvedAmount: 9100, costCentre: "Travel", status: "Open" },
  { poNumber: "PO-2024-009", vendorName: "DataBridge Analytics", approvedAmount: 33000, costCentre: "Finance", status: "Open" },
  { poNumber: "PO-2024-010", vendorName: "SecureVault Storage", approvedAmount: 5600, costCentre: "IT-Operations", status: "Open" },
];

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();

  for (const po of purchaseOrders) {
    await prisma.purchaseOrder.create({ data: po });
  }

  const vendorNames = Array.from(new Set(purchaseOrders.map((po) => po.vendorName)));
  for (const name of vendorNames) {
    await prisma.vendor.create({ data: { name } });
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);
  await prisma.user.create({
    data: { email: "analyst@financeos.demo", passwordHash, role: "analyst" },
  });

  console.log(`Seeded ${purchaseOrders.length} purchase orders, ${vendorNames.length} vendors, 1 demo user.`);
  console.log("Demo login: analyst@financeos.demo / demo1234");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
