import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding for Fighters Token...");

  // 1. Seed or update initial Super Admin
  const adminEmail = process.env.ADMIN_INITIAL_EMAIL || "admin@fighterstoken.com";
  const rawPassword = process.env.ADMIN_INITIAL_PASSWORD || "AdminFighters@2026!";
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
      totpEnabled: false, // Can be configured via /admin/totp-setup
    },
  });
  console.log(`✅ Admin user seeded: ${admin.email}`);

  // 2. Seed default active Campaign / Sale
  const existingSale = await prisma.sale.findFirst({
    where: { isLive: true },
  });

  let saleId;
  if (!existingSale) {
    const newSale = await prisma.sale.create({
      data: {
        title: "Fighters Token Sale 2026",
        description: "Official annual token booking sale for Fighters community members",
        totalTokens: 80,
        pricePerToken: 1000,
        currency: "INR",
        isLive: true,
        paymentsOpen: false,
        maxTokensPerMember: 5,
        holdDurationSeconds: 180,
        payByDeadlineDays: 7,
        autoAssignThresholdPercent: 10.0,
        autoAssignKTokens: 1,
        autoAssignTargetName: "Fighters Club Patron",
        autoAssignExecuted: false,
      },
    });
    saleId = newSale.id;
    console.log(`✅ Default Sale created: "${newSale.title}" (ID: ${saleId})`);
  } else {
    saleId = existingSale.id;
    console.log(`ℹ️ Existing active sale found: "${existingSale.title}"`);
  }

  // 3. Seed 80 tokens
  const existingTokenCount = await prisma.token.count({
    where: { saleId },
  });

  if (existingTokenCount < 80) {
    console.log(`Creating 80 tokens for sale ${saleId}...`);
    const tokenData = [];
    for (let i = 1; i <= 80; i++) {
      tokenData.push({
        saleId,
        tokenNumber: i,
        status: "AVAILABLE",
        isAdminAssigned: false,
        version: 0,
      });
    }

    await prisma.token.createMany({
      data: tokenData,
      skipDuplicates: true,
    });
    console.log(`✅ 80 tokens created and available (1 to 80).`);
  } else {
    console.log(`ℹ️ Tokens already exist (${existingTokenCount} tokens).`);
  }

  console.log("\n🎉 Database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
