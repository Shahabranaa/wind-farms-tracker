import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable, insertProjectSchema } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(projectsTable).orderBy(projectsTable.name);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
    const rows = await db.insert(projectsTable).values(parsed.data).returning();
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique")) { res.status(409).json({ error: "Slug already exists" }); return; }
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = insertProjectSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
    const rows = await db.update(projectsTable).set(parsed.data).where(eq(projectsTable.id, id)).returning();
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
