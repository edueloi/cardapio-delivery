import {
  Clock,
  LayoutDashboard,
  MessageSquare,
  Utensils,
  ExternalLink,
} from "lucide-react";
import {
  FilterLineSegmented,
  PageWrapper,
  SectionTitle,
  Button,
} from "../../components";
import type { Order, Tenant } from "../../types";
import {
  InventoryPanel,
  KitchenKDSPanel,
  MenuManagement,
  OrderHistoryPanel,
  OrdersList,
  ProfileManagement,
  ScheduledOrdersPanel,
  StaffList,
  TableManagement,
} from "./DashboardPanels";
import PDVPanel from "./PDVPanel";
import LoyaltyPanel from "./LoyaltyPanel";
import CashFlowPanel from "./CashFlowPanel";
import CustomerCRMPanel from "./CustomerCRMPanel";
import ReportsPanel from "./ReportsPanel";
import DownloadsPanel from "./DownloadsPanel";
import PromotionsPanel from "./PromotionsPanel";
import BundlesPanel from "./BundlesPanel";
import ProductionPanel from "./ProductionPanel";
import SuppliersPanel from "./SuppliersPanel";
import { WhatsAppManagementPanel } from "./WhatsAppPanel";
import OverviewPanel from "./OverviewPanel";
import EntradasSaidasPanel from "./EntradasSaidasPanel";
import { type DashboardOrderTabId, type DashboardTabId, type MyMembership, canAccess } from "./types";

interface DashboardContentProps {
  tenant: Tenant;
  slug: string;
  orders: Order[];
  activeTab: DashboardTabId;
  setActiveTab: (tab: DashboardTabId) => void;
  subTab: DashboardOrderTabId;
  setSubTab: (tab: DashboardOrderTabId) => void;
  filteredOrders: Order[];
  refreshTenant: () => Promise<void>;
  updateStatus: (orderId: string, status: string) => void | Promise<void>;
  activeOrderId?: string;
  checkoutRequests?: Array<{ tableId: string; customerName: string; timestamp: number }>;
  onClearTable?: (tableId: string) => void;
  waiterCalls?: Array<{ tableId: string; customerName: string; note: string; requestBill: boolean; timestamp: number }>;
  onDismissWaiterCall?: (ts: number) => void;
  membership?: MyMembership | null;
}

// Access-denied placeholder shown when a staff member navigates to a blocked tab directly
function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center">
        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
      </div>
      <div>
        <p className="text-lg font-black text-slate-800 uppercase tracking-widest mb-1">Acesso restrito</p>
        <p className="text-sm text-slate-400 max-w-xs">Você não tem permissão para acessar esta área. Contate o proprietário.</p>
      </div>
    </div>
  );
}

export default function DashboardContent({
  tenant,
  slug,
  orders,
  activeTab,
  setActiveTab,
  subTab,
  setSubTab,
  filteredOrders,
  refreshTenant,
  updateStatus,
  checkoutRequests,
  onClearTable,
  waiterCalls,
  onDismissWaiterCall,
  membership,
}: DashboardContentProps) {
  const allowed = (tab: DashboardTabId) => canAccess(membership ?? null, tab);
  const pendingOrders = orders.filter((order) => order.status === "PENDING").length;
  const preparingOrders = orders.filter((order) => order.status === "PREPARING").length;
  const shippedOrders = orders.filter((order) => order.status === "SHIPPED").length;

  // If the active tab is not accessible, show the access denied screen
  if (!allowed(activeTab)) return <AccessDenied />;

  return (
    <>
      {activeTab === "overview" && (
        <PageWrapper>
          <OverviewPanel
            tenant={tenant}
            slug={slug}
            orders={orders}
            setActiveTab={setActiveTab}
            setSubTab={setSubTab}
          />
        </PageWrapper>
      )}

      {activeTab === "live-orders" && (
        <PageWrapper>
          <SectionTitle
            title="Painel de Pedidos"
            description="O que está acontecendo agora?"
            icon={Clock}
            action={
              <FilterLineSegmented
                options={[
                  { value: "pending", label: `Pendentes (${pendingOrders})` },
                  { value: "preparing", label: `Cozinha (${preparingOrders})` },
                  { value: "shipped", label: `Prontos (${shippedOrders})` },
                ]}
                value={subTab}
                onChange={(id) => setSubTab(id as DashboardOrderTabId)}
              />
            }
            className="mb-6"
          />

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12">
              <OrdersList filteredOrders={filteredOrders} updateStatus={updateStatus} slug={slug} />
            </div>
          </div>
        </PageWrapper>
      )}

      {activeTab === "scheduled" && (
        <ScheduledOrdersPanel orders={orders} updateStatus={updateStatus} slug={slug} />
      )}

      {activeTab === "history" && (
        <PageWrapper>
          <OrderHistoryPanel
            orders={orders}
            slug={slug}
          />
        </PageWrapper>
      )}

      {activeTab === "menu" && (
        <div className="space-y-6">
          <div className="bg-[#0D1B3E] rounded-[28px] sm:rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl shadow-[#0D1B3E]/20 flex flex-col items-start gap-5 sm:flex-row sm:justify-between sm:items-center overflow-hidden relative">
            <div className="relative z-10 max-w-md">
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">Cardápio Inteligente</h3>
              <p className="text-[#C9A227]/80 font-medium text-sm sm:text-base">
                Gerencie categorias, preços e disponibilidades em tempo real.
              </p>
            </div>
            <Utensils className="w-24 h-24 sm:w-32 sm:h-32 absolute -right-6 -bottom-6 sm:-right-8 sm:-bottom-8 text-[#C9A227]/15 rotate-12" />
          </div>
          <MenuManagement tenant={tenant} refresh={refreshTenant} />
        </div>
      )}

      {activeTab === "finance" && (
        <CashFlowPanel slug={slug} tenant={tenant} />
      )}

      {activeTab === "entries" && (
        <EntradasSaidasPanel slug={slug} tenant={tenant} />
      )}

      {activeTab === "customers" && (
        <CustomerCRMPanel slug={slug} tenant={tenant} />
      )}

      {activeTab === "reports" && (
        <ReportsPanel slug={slug} tenant={tenant} />
      )}

      {activeTab === "downloads" && (
        <DownloadsPanel />
      )}

      {activeTab === "whatsapp" && (
        <div className="space-y-6">
          <SectionTitle
            title="WhatsApp e Bot"
            description="Conecte um número por estabelecimento e configure o atendimento automático."
            icon={MessageSquare}
          />
          <WhatsAppManagementPanel tenant={tenant} onUpdated={refreshTenant} />
        </div>
      )}

      {activeTab === "profile" && (
        <ProfileManagement tenant={tenant} refresh={refreshTenant} />
      )}

      {activeTab === "staff" && (
        <div className="space-y-6">
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            Equipe de Atendimento
          </h3>
          <StaffList tenant={tenant} />
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight underline decoration-[#C9A227] decoration-4 underline-offset-4">
              Gestão de Insumos
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Estoque Integrado
              </span>
            </div>
          </div>
          <InventoryPanel tenant={tenant} />
        </div>
      )}

      {activeTab === "production" && (
        <ProductionPanel tenant={tenant} />
      )}
      {activeTab === "suppliers" && (
        <SuppliersPanel tenant={tenant} />
      )}

      {activeTab === "tables" && (
        <div className="space-y-6">
          <TableManagement tenant={tenant} />
        </div>
      )}
      {activeTab === "pos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">PDV — Caixa</h3>
              <p className="text-xs text-slate-400 mt-0.5">Venda rápida integrada ao painel</p>
            </div>
            {!(window as any).pdvDesktop && (
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<ExternalLink className="w-4 h-4" />}
                onClick={() => window.open(`/pdv/${slug}`, "_blank", "width=1280,height=800")}
              >
                Abrir em Tela Cheia
              </Button>
            )}
          </div>
          <PDVPanel
            tenant={tenant}
            onOrderCreated={refreshTenant}
            checkoutRequests={checkoutRequests}
            onClearTable={onClearTable}
            orders={orders}
          />
        </div>
      )}
      {activeTab === "loyalty" && (
        <LoyaltyPanel tenant={tenant} onUpdated={refreshTenant} />
      )}
      {activeTab === "promotions" && (
        <PromotionsPanel tenant={tenant} />
      )}
      {activeTab === "bundles" && (
        <BundlesPanel tenant={tenant} />
      )}
      {activeTab === "kds" && (
        <KitchenKDSPanel orders={orders} updateStatus={updateStatus} waiterCalls={waiterCalls} onDismissWaiterCall={onDismissWaiterCall} />
      )}
    </>
  );
}
