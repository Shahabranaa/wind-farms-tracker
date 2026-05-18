import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import type { ApiProject } from "@/lib/types";

interface ProjectForm {
  name: string;
  slug: string;
  sheetUrl: string;
  mapCenter: string;
  mapZoom: string;
}

const empty: ProjectForm = { name: "", slug: "", sheetUrl: "", mapCenter: "", mapZoom: "11" };

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProjectForm>(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: projects = [], isLoading } = useQuery<ApiProject[]>({
    queryKey: ["projects"],
    queryFn: () => api.projects.list() as Promise<ApiProject[]>,
  });

  const createMut = useMutation({
    mutationFn: (data: ProjectForm) =>
      api.projects.create({ ...data, mapZoom: Number(data.mapZoom) || 11 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProjectForm }) =>
      api.projects.update(id, { ...data, mapZoom: Number(data.mapZoom) || 11 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.projects.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  function openCreate() { setForm(empty); setEditing(null); setShowModal(true); }
  function openEdit(p: ApiProject) {
    setForm({ name: p.name, slug: p.slug, sheetUrl: p.sheetUrl ?? "", mapCenter: p.mapCenter ?? "", mapZoom: String(p.mapZoom ?? 11) });
    setEditing(p.id);
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditing(null); setForm(empty); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing !== null) updateMut.mutate({ id: editing, data: form });
    else createMut.mutate(form);
  }

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Projects</h1>
              <p className="text-sm text-muted-foreground mt-1">{projects.length} projects configured</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity"
              style={{ background: "hsl(207 79% 63%)" }}
            >
              <Plus className="h-4 w-4" /> New Project
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg border"
                  style={{ background: "hsl(207 79% 22%)", borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      {p.active ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteMut.mutate(p.id)} className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {!projects.length && (
                <div className="text-center py-16 text-sm text-muted-foreground">No projects yet. Create one above.</div>
              )}
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-xl border p-6" style={{ background: "hsl(207 79% 22%)", borderColor: "rgba(255,255,255,0.1)" }}>
            <h2 className="text-base font-semibold text-foreground mb-4">{editing ? "Edit Project" : "New Project"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {(["name", "slug", "sheetUrl", "mapCenter", "mapZoom"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-foreground/80 mb-1 capitalize">{field.replace(/([A-Z])/g, " $1")}</label>
                  <input
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    required={field === "name" || field === "slug"}
                    className="w-full px-3 py-1.5 rounded text-sm text-foreground outline-none"
                    style={{ background: "hsl(207 77% 17%)", border: "1px solid hsl(207 40% 32%)" }}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" disabled={isPending} className="flex-1 py-2 rounded text-sm font-medium text-white disabled:opacity-60 transition-opacity" style={{ background: "hsl(207 79% 63%)" }}>
                  {isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
