import { Navigate, Outlet } from "react-router-dom";
import { useMeQuery } from "../redux/api/authApi";

/** Gates every dashboard route behind a valid session cookie — checked by
 * calling /auth/me rather than trusting any client-side flag, since the
 * cookie is httpOnly and JS can't read it directly. */
export default function ProtectedRoute() {
  const { isLoading, isError } = useMeQuery();

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  }
  if (isError) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
