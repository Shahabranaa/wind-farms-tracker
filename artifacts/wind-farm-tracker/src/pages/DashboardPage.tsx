import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, FolderKanban, Building2, Map, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { ApiUser, ApiProject } from "@/lib/types";

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();

  const usersQuery = useQuery<ApiUser[]>({
    queryKey: ["users"],
    queryFn: () => api.users.list() as Promise<ApiUser[]>,
    enabled: isAdmin,
  });

  const projectsQuery = useQuery<ApiProject[]>({
    queryKey: ["projects"],
    queryFn: () => api.projects.list() as Promise<ApiProject[]>,
    enabled: isAdmin,
  });

  const stats = [
    {
      label: "Projects",
      value: projectsQuery.data?.length ?? "—",
      icon: <FolderKanban className="h-5 w-5" />,
      href: "/dashboard/projects",
      color: "hsl(207 79% 63%)",
    },
    {
      label: "Users",
      value: usersQuery.data?.length ?? "—",
      icon: <Users className="h-5 w-5" />,
      href: "/dashboard/users",
      color: "hsl(142 71% 45%)",
    },
    {
      label: "Active Maps",
      value: projectsQuery.data?.filter((p) => p.active).length ?? "—",
      icon: <Map className="h-5 w-5" />,
      href: "/",
      color: "hsl(38 92% 50%)",
    },
    {
      label: "Companies",
      value: "—",
      icon: <Building2 className="h-5 w-5" />,
      href: "/dashboard",
      color: "hsl(280 65% 60%)",
    },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Welcome back, {user?.email}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <Link key={s.label} href={s.href}>
                <div
                  className="rounded-lg border p-4 flex flex-col gap-3 hover:bg-white/5 transition-colors cursor-pointer"
                  style={{
                    background: "hsl(207 79% 22%)",
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: s.color + "22", color: s.color }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Link href="/dashboard/projects">
              <div
                className="rounded-lg border p-5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                style={{ background: "hsl(207 79% 22%)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">Manage Projects</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Create and configure map projects</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/dashboard/users">
              <div
                className="rounded-lg border p-5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                style={{ background: "hsl(207 79% 22%)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">Manage Users</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Invite and manage team members</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
