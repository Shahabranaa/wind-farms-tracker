import { Router } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, insertUserSchema } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        isAdmin: usersTable.isAdmin,
        isActive: usersTable.isActive,
        companyId: usersTable.companyId,
        dateJoined: usersTable.dateJoined,
      })
      .from(usersTable)
      .orderBy(usersTable.dateJoined);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { email, password, isAdmin, companyId } = req.body as {
      email: string; password: string; isAdmin?: boolean; companyId?: number;
    };
    if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const parsed = insertUserSchema.safeParse({ email: email.toLowerCase().trim(), passwordHash, isAdmin: isAdmin ?? false, companyId });
    if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
    const rows = await db.insert(usersTable).values(parsed.data).returning({
      id: usersTable.id, email: usersTable.email, isAdmin: usersTable.isAdmin,
      isActive: usersTable.isActive, companyId: usersTable.companyId, dateJoined: usersTable.dateJoined,
    });
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique")) { res.status(409).json({ error: "Email already exists" }); return; }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isActive, isAdmin, companyId } = req.body as { isActive?: boolean; isAdmin?: boolean; companyId?: number };
    const update: Partial<{ isActive: boolean; isAdmin: boolean; companyId: number }> = {};
    if (isActive !== undefined) update.isActive = isActive;
    if (isAdmin !== undefined) update.isAdmin = isAdmin;
    if (companyId !== undefined) update.companyId = companyId;
    const rows = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning({
      id: usersTable.id, email: usersTable.email, isAdmin: usersTable.isAdmin,
      isActive: usersTable.isActive, companyId: usersTable.companyId, dateJoined: usersTable.dateJoined,
    });
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
