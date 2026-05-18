import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    const user = rows[0];
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;

    res.json({ id: user.id, email: user.email, isAdmin: user.isAdmin, isActive: user.isActive });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, async (req, res) => {
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
      .where(eq(usersTable.id, req.session.userId!))
      .limit(1);

    const user = rows[0];
    if (!user) {
      req.session.destroy(() => undefined);
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
