/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { AuthGuard, ToastProvider } from "./components";
import MenuView from "./pages/MenuView";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LandingPage from "./pages/LandingPage";
import PublicDashboard from "./features/public-dashboard";
import PDVPage from "./pages/PDVPage";
import KitchenDisplayPage from "./pages/KitchenDisplayPage";
import SuperAdminPage from "./features/superadmin/SuperAdminPage";
import CondominiumPage from "./features/condominium-view/CondominiumPage";
import AdminAccessPage from "./features/auth/AdminAccessPage";
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
          <Route path="/admin" element={<AdminAccessPage />} />
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

          <Route path="/painel" element={<Navigate to="/login" replace />} />

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
          <Route path="/cond/:slug" element={<CondominiumPage />} />

          <Route
            path="/pdv/:slug"
            element={
              <AuthGuard>
                <PDVPage />
              </AuthGuard>
            }
          />

          <Route
            path="/garcom/:slug"
            element={
              <AuthGuard>
                <PDVPage mode="waiter" />
              </AuthGuard>
            }
          />

          <Route
            path="/cozinha/:slug"
            element={
              <AuthGuard>
                <KitchenDisplayPage />
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
      <ToastProvider>
        <AnimatedRoutes />
      </ToastProvider>
    </Router>
  );
}
