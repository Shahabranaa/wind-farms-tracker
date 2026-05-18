const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    logout: () => request("/auth/logout", { method: "POST" }),
    me: () => request("/auth/me"),
  },
  projects: {
    list: () => request("/projects"),
    get: (id: number) => request(`/projects/${id}`),
    create: (data: unknown) =>
      request("/projects", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: unknown) =>
      request(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) => request(`/projects/${id}`, { method: "DELETE" }),
  },
  users: {
    list: () => request("/users"),
    create: (data: unknown) =>
      request("/users", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: unknown) =>
      request(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) => request(`/users/${id}`, { method: "DELETE" }),
  },
  companies: {
    list: () => request("/companies"),
    create: (data: unknown) =>
      request("/companies", { method: "POST", body: JSON.stringify(data) }),
  },
};
