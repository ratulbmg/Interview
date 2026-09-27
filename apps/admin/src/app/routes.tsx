import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../component/ProtectedRoute";
import Layout from "../component/Layout";
import Login from "../pages/Login/Login";
import Candidates from "../pages/Candidates/Candidates";
import Sessions from "../pages/Sessions/Sessions";
import SessionDetail from "../pages/SessionDetail/SessionDetail";
import Questions from "../pages/Questions/Questions";
import Room from "../pages/Room/Room";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public — candidates never log in (see apps/api's meetingProvider.ts,
          which mints this URL). */}
      <Route path="/room/:token" element={<Room />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/candidates" replace />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/questions" element={<Questions />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
