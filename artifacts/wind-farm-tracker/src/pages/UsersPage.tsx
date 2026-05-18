import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, UserX, UserCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";
import type { ApiUser } from "@/lib/types";

export default function UsersPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", isAdmin: false });

  const { data: users = [], isLoading } = useQuery<ApiUser[]>({
    queryKey: ["users"],
    queryFn: () => api.users.list() as Promise<ApiUser[]>,
  });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => api.users.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); setShowModal(false); setForm({ email: "", password: "", isAdmin: false }); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.users.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Users</h1>
              <p className="text-sm text-muted-foreground mt-1">{users.length} team members</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white"
              style={{ background: "hsl(207 79% 63%)" }}
            >
              <Plus className="h-4 w-4" /> Invite User
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <span className="text-sm text-muted-foreground animate-pulse">Loading…</span>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg border"
                  style={{ background: "hsl(207 79% 22%)", borderColor: "rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{ background: "hsl(207 79% 63% / 0.2)", color: "hsl(207 79% 63%)" }}
                  >
                    {u.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{u.email}</span>
                      {u.isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-primary" title="Admin" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(u.dateJoined).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "text-green-400 bg-green-400/10" : "text-muted-foreground bg-white/5"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </div>
                  <button
                    onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                    className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                    title={u.isActive ? "Deactivate" : "Activate"}
                  >
                    {u.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
              {!users.length && (
                <div className="text-center py-16 text-sm text-muted-foreground">No users yet.</div>
              )}
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-sm rounded-xl border p-6" style={{ background: "hsl(207 79% 22%)", borderColor: "rgba(255,255,255,0.1)" }}>
            <h2 className="text-base font-semibold text-foreground mb-4">Invite User</h2>
            <form
              onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-medium text-foreground/80 mb-1">Email</label>
                <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded text-sm text-foreground outline-none"
                  style={{ background: "hsl(207 77% 17%)", border: "1px solid hsl(207 40% 32%)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground/80 mb-1">Password</label>
                <input type="password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded text-sm text-foreground outline-none"
                  style={{ background: "hsl(207 77% 17%)", border: "1px solid hsl(207 40% 32%)" }} />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer">
                <input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm((f) => ({ ...f, isAdmin: e.target.checked }))} />
                Admin access
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="flex-1 py-2 rounded text-sm font-medium text-white disabled:opacity-60" style={{ background: "hsl(207 79% 63%)" }}>
                  {createMut.isPending ? "Inviting…" : "Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
