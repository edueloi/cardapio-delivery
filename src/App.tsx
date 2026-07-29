/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
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
import KitchenGlobalPage from "./pages/KitchenGlobalPage";
import SuperAdminPage from "./features/superadmin/SuperAdminPage";
import CondominiumPage from "./features/condominium-view/CondominiumPage";
import CounterMenuView from "./features/menu-view/CounterMenuView";
import AdminAccessPage from "./features/auth/AdminAccessPage";
import InviteRegisterPage from "./features/auth/InviteRegisterPage";
import ForgotPasswordPage from "./features/auth/ForgotPasswordPage";
import ResetPasswordPage from "./features/auth/ResetPasswordPage";
import TvAppPage from "./pages/TvAppPage";

// Em cozinha.boxsys.com.br a raiz "/" deve cair direto na tela de login da
// cozinha, sem precisar digitar "/cozinha" no final — mais fácil de favoritar
// no tablet. Em qualquer outro domínio, mostra a landing page normal.
function HomeOrKitchen() {
  if (typeof window !== "undefined" && window.location.hostname.startsWith("cozinha.")) {
    return <KitchenGlobalPage />;
  }
  return <LandingPage />;
}

function AnimatedRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname.startsWith("/dashboard/");
  const routeKey = isDashboard
    ? location.pathname.split("/").slice(0, 3).join("/")
    : location.pathname;

  // Ponte com o app desktop Electron (PDV): reporta qual tenant está aberto agora,
  // pra o menu nativo "Navegar" saber montar a URL de destino (ver pdv-desktop/src/
  // main.js → navigateTo), e escuta cliques desse menu pra trocar de rota sem recarregar
  // a página inteira. Só existe window.pdvDesktop dentro do app desktop — no navegador
  // normal, isso é um no-op.
  useEffect(() => {
    const desktop = (window as any).pdvDesktop;
    if (!desktop) return;
    const slug = isDashboard ? location.pathname.split("/")[2] : null;
    desktop.reportCurrentSlug?.(slug);
  }, [isDashboard, location.pathname]);

  useEffect(() => {
    const desktop = (window as any).pdvDesktop;
    if (!desktop?.onNavigate) return;
    return desktop.onNavigate((path: string) => navigate(path));
  }, [navigate]);

  // Preferência "esconder menu do sistema" (controlada pelo menu nativo Exibir do app
  // desktop, já que o menu nativo passa a cobrir a navegação e a barra/sidebar do
  // próprio site fica redundante). Grava em localStorage + dispara um evento customizado
  // pro DashboardShell reagir na hora, mesmo já montado (o evento "storage" nativo só
  // dispara em outras abas, nunca na mesma aba que gravou).
  useEffect(() => {
    const desktop = (window as any).pdvDesktop;
    if (!desktop?.onSetHideSystemMenu) return;
    return desktop.onSetHideSystemMenu((hidden: boolean) => {
      try { window.localStorage.setItem("boxsys_hide_system_nav", hidden ? "1" : "0"); } catch {}
      window.dispatchEvent(new CustomEvent("boxsys:hide-system-nav-changed", { detail: hidden }));
    });
  }, []);

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
          <Route path="/tv-app" element={<TvAppPage />} />
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

          {/* Login próprio (senha da cozinha) — não usa o AuthGuard do dashboard */}
          <Route path="/cozinha/:slug" element={<KitchenDisplayPage />} />
          {/* cozinha.boxsys.com.br: login global por usuário próprio, sem slug na URL */}
          <Route path="/cozinha" element={<KitchenGlobalPage />} />

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
            path="/:slug/balcao"
            element={
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <CounterMenuView />
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

          <Route path="/" element={<HomeOrKitchen />} />
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
