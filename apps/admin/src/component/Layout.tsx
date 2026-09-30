import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  TbCalendarEvent,
  TbChartBar,
  TbChevronLeft,
  TbChevronRight,
  TbClipboardCheck,
  TbHelpCircle,
  TbLayoutDashboard,
  TbLogout,
  TbUserCog,
  TbUsers,
} from "react-icons/tb";
import { cn } from "@repo/ui";
import { useLogoutMutation, useMeQuery } from "../redux/api/authApi";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: TbLayoutDashboard },
  { to: "/users", label: "Users", icon: TbUserCog },
  { to: "/usage", label: "AI Usage", icon: TbChartBar },
  { to: "/candidates", label: "Candidates", icon: TbUsers },
  { to: "/sessions", label: "Sessions", icon: TbCalendarEvent },
  { to: "/questions", label: "Questions", icon: TbHelpCircle },
  { to: "/results", label: "Results", icon: TbClipboardCheck },
];

// Purely a per-viewer convenience (remembering the collapsed/expanded
// choice across reloads) — never anything the server needs to know about.
const SIDEBAR_COLLAPSED_KEY = "admin.sidebarCollapsed";

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export default function Layout() {
  const { data: me } = useMeQuery();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Best-effort only — a private window or blocked storage just means
        // the choice doesn't survive a reload, nothing else depends on it.
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    // h-screen (not min-h-screen) is what pins this row to exactly the
    // viewport height — with min-h-screen, a long page (e.g. the question
    // bank with 100+ rows) grows the whole flex row past the viewport, so
    // the page itself scrolls and drags the sidebar's logout button down
    // with it. Fixed at h-screen, only <main>'s own overflow-y-auto
    // scrolls, and the sidebar (including the logout button pinned to its
    // bottom via flex-1 on <nav>) stays put regardless of content length.
    <div className="flex h-screen bg-background">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150",
          collapsed ? "w-16" : "w-56",
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-foreground">
              Interview Platform
            </span>
          )}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              collapsed && "mx-auto",
            )}
          >
            {collapsed ? (
              <TbChevronRight className="size-4" />
            ) : (
              <TbChevronLeft className="size-4" />
            )}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          {me && !collapsed && (
            <p className="mb-2 truncate px-1 text-xs text-muted-foreground">
              {me.name}
            </p>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? "Log out" : undefined}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <TbLogout className="size-4 shrink-0" />
            {!collapsed && "Log out"}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
