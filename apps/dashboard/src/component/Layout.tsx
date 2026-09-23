import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useLogoutMutation, useMeQuery } from "../redux/api/authApi";

const navItems = [
  { to: "/candidates", label: "Candidates" },
  { to: "/sessions", label: "Sessions" },
  { to: "/questions", label: "Questions" },
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
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <nav className="flex gap-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? "text-blue-600" : "text-gray-600 hover:text-gray-900"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          {me && <span>{me.name}</span>}
          <button
            onClick={handleLogout}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
