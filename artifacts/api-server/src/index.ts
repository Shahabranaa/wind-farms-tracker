import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminIfNeeded() {
  try {
    const rows = await db.select({ total: count() }).from(usersTable);
    if ((rows[0]?.total ?? 0) === 0) {
      const passwordHash = await bcrypt.hash("admin123", 10);
      await db.insert(usersTable).values({
        email: "admin@example.com",
        passwordHash,
        isAdmin: true,
        isActive: true,
      });
      logger.info("Seeded default admin user: admin@example.com / admin123");
    }
  } catch (err) {
    logger.warn({ err }, "Could not seed admin user — DB may not be ready yet");
  }
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  void seedAdminIfNeeded();
});
