import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { TbCalendarEvent, TbHelpCircle, TbLogout, TbUsers } from "react-icons/tb";
import { cn } from "@repo/ui";
import { useLogoutMutation, useMeQuery } from "../redux/api/authApi";

const navItems = [
  { to: "/candidates", label: "Candidates", icon: TbUsers },
  { to: "/sessions", label: "Sessions", icon: TbCalendarEvent },
  { to: "/questions", label: "Questions", icon: TbHelpCircle },
];

export default function Layout() {
  const { data: me } = useMeQuery();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="px-4 py-4">
          <span className="text-sm font-semibold text-foreground">
            Interview Platform
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          {me && (
            <p className="mb-2 truncate px-1 text-xs text-muted-foreground">
              {me.name}
            </p>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <TbLogout className="size-4" />
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
