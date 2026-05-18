import { memo } from "react";
import { Link, useLocation } from "wouter";
import { Wind, LayoutDashboard, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const [location] = useLocation();

  const navLink = (href: string, label: string) => {
    const active = location === href || location.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          active
            ? "bg-primary/20 text-primary"
            : "text-foreground/70 hover:text-foreground hover:bg-white/5"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      className="h-12 flex-shrink-0 flex items-center px-4 gap-4 border-b border-border"
      style={{ background: "hsl(207 79% 19%)" }}
    >
      <Link href="/" className="flex items-center gap-2 mr-2">
        <Wind className="h-5 w-5 text-primary" strokeWidth={1.5} />
        <span className="text-sm font-semibold tracking-wide text-foreground">
          SPX <span className="text-primary">SMART MAP</span>
        </span>
      </Link>

      <div className="flex items-center gap-1">
        {navLink("/", "Map")}
        {isAdmin && (
          <>
            <Link
              href="/dashboard"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                location.startsWith("/dashboard")
                  ? "bg-primary/20 text-primary"
                  : "text-foreground/70 hover:text-foreground hover:bg-white/5"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            <span className="text-xs text-muted-foreground hidden sm:block">
              {user.email}
            </span>
            <button
              onClick={() => void logout()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-white/5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

export default memo(Navbar);
