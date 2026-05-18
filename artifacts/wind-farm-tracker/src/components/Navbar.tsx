import { memo } from "react";
import { Link, useLocation } from "wouter";
import { Wind, LayoutDashboard, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMapTab, PROJECT_TABS, type ProjectTab } from "@/context/MapTabContext";

function ProjectTabs() {
  const { activeTab, setActiveTab } = useMapTab();

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar flex-1 min-w-0 mx-2">
      {PROJECT_TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ProjectTab)}
            className="flex-shrink-0 px-3 py-1 rounded text-xs font-medium transition-all whitespace-nowrap"
            style={{
              background: active ? "hsl(207 79% 63% / 0.18)" : "transparent",
              color: active ? "hsl(207 79% 73%)" : "hsl(214 17% 55%)",
              border: active ? "1px solid hsl(207 79% 63% / 0.35)" : "1px solid transparent",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const [location] = useLocation();
  const isMapPage = location === "/" || location === "";

  return (
    <nav
      className="h-11 flex-shrink-0 flex items-center px-3 gap-2 border-b border-border"
      style={{ background: "hsl(207 79% 16%)" }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-1.5 flex-shrink-0">
        <Wind className="h-4 w-4 text-primary" strokeWidth={1.5} />
        <span className="text-xs font-semibold tracking-wide text-foreground whitespace-nowrap">
          SPX <span className="text-primary">SMART MAP</span>
        </span>
      </Link>

      <div className="w-px h-4 bg-border flex-shrink-0" />

      {/* Project tabs — only on map page */}
      {isMapPage ? (
        <ProjectTabs />
      ) : (
        <div className="flex-1" />
      )}

      {/* Right-side links */}
      <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
        {isAdmin && (
          <Link
            href="/dashboard"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              location.startsWith("/dashboard")
                ? "bg-primary/20 text-primary"
                : "text-foreground/60 hover:text-foreground hover:bg-white/5"
            }`}
          >
            <LayoutDashboard className="h-3 w-3" />
            Dashboard
          </Link>
        )}

        {user ? (
          <>
            <span className="text-[10px] text-muted-foreground hidden sm:block px-1">
              {user.email}
            </span>
            <button
              onClick={() => void logout()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-white/5"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1"
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
