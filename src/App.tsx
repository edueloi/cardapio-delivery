/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { AuthGuard } from "./components";
import MenuView from "./pages/MenuView";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import OwnerPortal from "./pages/OwnerPortal";
import Register from "./pages/Register";
import LandingPage from "./pages/LandingPage";
import PublicDashboard from "./features/public-dashboard";
import PDVPage from "./pages/PDVPage";
import SuperAdminPage from "./features/superadmin/SuperAdminPage";
import InviteRegisterPage from "./features/auth/InviteRegisterPage";
import ForgotPasswordPage from "./features/auth/ForgotPasswordPage";
import ResetPasswordPage from "./features/auth/ResetPasswordPage";

function AnimatedRoutes() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard/");
  const routeKey = isDashboard
    ? location.pathname.split("/").slice(0, 3).join("/")
    : location.pathname;

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={routeKey}>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/cadastro/:token" element={<InviteRegisterPage />} />
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha/:token" element={<ResetPasswordPage />} />
          <Route
            path="/superadmin"
            element={
              <AuthGuard>
                <SuperAdminPage />
              </AuthGuard>
            }
          />

          <Route
            path="/painel"
            element={
              <AuthGuard>
                <OwnerPortal />
              </AuthGuard>
            }
          />

          <Route
            path="/dashboard/:slug"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/dashboard/:slug/historico/:orderId"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/dashboard/:slug/:tab"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />

          <Route path="/:slug/display" element={<PublicDashboard />} />

          <Route
            path="/pdv/:slug"
            element={
              <AuthGuard>
                <PDVPage />
              </AuthGuard>
            }
          />

          <Route
            path="/:slug/mesa/:tableId"
            element={
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <MenuView />
              </motion.div>
            }
          />

          <Route
            path="/:slug"
            element={
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <MenuView />
              </motion.div>
            }
          />

          <Route path="/" element={<LandingPage />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AnimatedRoutes />
    </Router>
  );
}
