import {
  Clock,
  LayoutDashboard,
  MessageSquare,
  Utensils,
  ChefHat,
  CheckCircle2,
  AlertCircle,
  History
} from "lucide-react";
import {
  FilterLineSegmented,
  PageWrapper,
  SectionTitle,
} from "../../components";
import type { Order, Tenant } from "../../types";
import {
  BundlesPanel,
  CashFlowPanel,
  CustomerCRMPanel,
  DisplayPanelSettingsPanel,
  DownloadsPanel,
  EntradasSaidasPanel,
  IfoodPanel,
  InventoryPanel,
  KitchenKDSPanel,
  LoyaltyPanel,
  MenuManagement,
  NfceHistoryPanel,
  OrderHistoryPanel,
  OrdersList,
  OverviewPanel,
  PDVPanel,
  ProductionPanel,
  ProfileManagement,
  PromotionsPanel,
  ReportsPanel,
  ScheduledOrdersPanel,
  StaffList,
  SuppliersPanel,
  TableManagement,
  WaiterPanel,
  WhatsAppManagementPanel,
  ManualPanel,
} from "./pages";
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
  onClearComanda?: (orderId: string) => void;
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
  onClearComanda,
  waiterCalls,
  onDismissWaiterCall,
  membership,
  activeOrderId
}: DashboardContentProps) {
  const allowed = (tab: DashboardTabId) => canAccess(membership ?? null, tab);
  const pendingOrders = orders.filter((order) => order.status === "PENDING").length;
  const preparingOrders = orders.filter((order) => order.status === "PREPARING").length;
  const shippedOrders = orders.filter((order) => order.status === "SHIPPED").length;
  const delayedOrders = orders.filter((order) => (order.status === "PENDING" || order.status === "PREPARING") && Date.now() - new Date(order.createdAt).getTime() > 30 * 60000).length;
  const activeOrders = orders.filter((order) => order.status !== "DELIVERED" && order.status !== "CANCELLED" && order.status !== "MERGED");

  // If the active tab is not accessible, show the access denied screen
  if (!allowed(activeTab)) return <AccessDenied />;

  return (
    <>
      {/* Overview is the only full-width section now */}
      {activeTab === "overview" && (
        <OverviewPanel
          tenant={tenant}
          slug={slug}
          orders={orders}
          setActiveTab={setActiveTab}
          setSubTab={setSubTab}
        />
      )}

      {/* Standard wrapped sections */}
      {activeTab === "history" && (
        <PageWrapper>

          <OrderHistoryPanel
            orders={orders}
            slug={slug}
            isOwner={membership?.role === "OWNER"}
            onOrderChanged={refreshTenant}
          />
        </PageWrapper>
      )}

      {activeTab === "live-orders" && (
        <PageWrapper className="px-0 sm:px-1 lg:px-2 xl:px-3 pt-0">
          <SectionTitle
            title="Painel de Pedidos"
            description="O que está acontecendo agora?"
            icon={Clock}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Pendentes: {pendingOrders}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg border border-orange-200">
                  <ChefHat className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Em Preparo: {preparingOrders}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Prontos: {shippedOrders}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Atrasados: {delayedOrders}</span>
                </div>
              </div>
            }
            className="hidden"
          />

          <OrdersList filteredOrders={activeOrders} updateStatus={updateStatus} slug={slug} tenant={tenant} />
        </PageWrapper>
      )}

      {activeTab === "scheduled" && (
        <ScheduledOrdersPanel orders={orders} updateStatus={updateStatus} slug={slug} />
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
          <MenuManagement tenant={tenant} refresh={refreshTenant} membership={membership} />
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

      {activeTab === "nfce" && (
        <NfceHistoryPanel slug={slug} tenant={tenant} />
      )}

      {activeTab === "display-panel" && (
        <DisplayPanelSettingsPanel slug={slug} tenant={tenant} />
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
        <div className="flex flex-col h-full min-h-0">
          <div className="flex-1 min-h-0">
            <PDVPanel
              tenant={tenant}
              onOrderCreated={refreshTenant}
              checkoutRequests={checkoutRequests}
              onClearTable={onClearTable}
              onClearComanda={onClearComanda}
              orders={orders}
              onOpenFullscreen={
                (window as any).pdvDesktop
                  ? undefined
                  : () => window.open(`/pdv/${slug}`, "_blank", "width=1280,height=800")
              }
            />
          </div>
        </div>
      )}
      {activeTab === "waiter" && (
        <div className="flex flex-col h-[calc(100vh-6.5rem)] min-h-0">
          <div className="flex-1 min-h-0">
            <WaiterPanel
              tenant={tenant}
              operatorName={membership?.name || null}
              onOrderCreated={refreshTenant}
              orders={orders}
              waiterCalls={waiterCalls}
              onOpenFullscreen={() => window.open(`/garcom/${slug}`, "_blank", "width=1024,height=768")}
            />
          </div>
        </div>
      )}
      {activeTab === "loyalty" && (
        <LoyaltyPanel tenant={tenant} onUpdated={refreshTenant} />
      )}
      {activeTab === "ifood" && (
        <IfoodPanel tenant={tenant} onNavigate={setActiveTab} />
      )}
      {activeTab === "promotions" && (
        <PromotionsPanel tenant={tenant} />
      )}
      {activeTab === "bundles" && (
        <BundlesPanel tenant={tenant} />
      )}
      {activeTab === "manual" && (
        <ManualPanel membership={membership ?? null} />
      )}
      {activeTab === "kds" && (
        <KitchenKDSPanel orders={orders} updateStatus={updateStatus} waiterCalls={waiterCalls} onDismissWaiterCall={onDismissWaiterCall} />
      )}
    </>
  );
}
