import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Wind, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, user } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate("/");
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "hsl(207 77% 17%)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8 border"
        style={{
          background: "hsl(207 79% 22%)",
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: "hsl(207 79% 63% / 0.15)" }}
          >
            <Wind className="h-6 w-6 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="text-lg font-semibold text-foreground">SPX Smart Map</h1>
          <p className="text-xs text-muted-foreground mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground/80">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 rounded-md text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors"
              style={{
                background: "hsl(207 77% 17%)",
                border: "1px solid hsl(207 40% 32%)",
              }}
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foreground/80">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-md text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors"
              style={{
                background: "hsl(207 77% 17%)",
                border: "1px solid hsl(207 40% 32%)",
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "hsl(207 79% 63%)" }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          Default: admin@example.com / admin123
        </p>
      </div>
    </div>
  );
}
