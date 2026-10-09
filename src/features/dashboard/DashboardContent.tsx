import {
  Clock,
  MessageSquare,
  ChefHat,
  CheckCircle2,
  AlertCircle,
  Package,
  Users,
} from "lucide-react";
import {
  Badge,
  PageWrapper,
  SectionTitle,
  StatCard,
  StatGrid,
} from "../../components";
import type { Order, Tenant } from "../../types";
import {
  BundlesPanel,
  CashFlowPanel,
  CustomerCRMPanel,
  DeliveryDriversPanel,
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
      <div className="w-14 h-14 rounded-lg bg-red-50 flex items-center justify-center">
        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
      </div>
      <div>
        <p className="text-base font-medium text-slate-900 mb-1">Acesso restrito</p>
        <p className="text-xs text-slate-500 max-w-xs">Você não tem permissão para acessar esta área. Contate o proprietário.</p>
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
  const activeOrders = orders.filter((order) =>
    (order.status !== "DELIVERED" && order.status !== "CANCELLED" && order.status !== "MERGED") ||
    // Delivery entregue mas ainda não faturado (pagamento na entrega) continua
    // aparecendo no painel, na coluna "Ag. Faturamento", até ser faturado.
    (order.orderType === "DELIVERY" && order.status === "DELIVERED" && !order.billed)
  );

  // If the active tab is not accessible, show the access denied screen
  if (!allowed(activeTab)) return <AccessDenied />;

  // PDV e Garçom ocupam a área inteira; as demais telas ficam dentro de um único
  // PageWrapper (os PageWrapper das telas viram apenas contêineres internos).
  const fullBleed = activeTab === "pos" || activeTab === "waiter";

  const content = (
    <>
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
        <div>
          <OrderHistoryPanel
            orders={orders}
            slug={slug}
            tenant={tenant}
            isOwner={membership?.role === "OWNER" || membership?.role === "ADMIN"}
            onOrderChanged={refreshTenant}
          />
        </div>
      )}

      {activeTab === "live-orders" && (
        <div className="space-y-4">
          <SectionTitle
            title="Painel de Pedidos"
            description="O que está acontecendo agora?"
            icon={Clock}
          />
          <StatGrid cols={4}>
            <StatCard title="Pendentes" value={pendingOrders} icon={Clock} color="warning" />
            <StatCard title="Em preparo" value={preparingOrders} icon={ChefHat} color="info" />
            <StatCard title="Prontos" value={shippedOrders} icon={CheckCircle2} color="success" />
            <StatCard title="Atrasados" value={delayedOrders} icon={AlertCircle} color="danger" />
          </StatGrid>

          <OrdersList filteredOrders={activeOrders} updateStatus={updateStatus} slug={slug} tenant={tenant} />
        </div>
      )}

      {activeTab === "scheduled" && (
        <ScheduledOrdersPanel orders={orders} updateStatus={updateStatus} slug={slug} />
      )}

      {activeTab === "menu" && (
        <MenuManagement tenant={tenant} refresh={refreshTenant} membership={membership} />
      )}

      {activeTab === "drivers" && (
        <DeliveryDriversPanel slug={slug} tenant={tenant} />
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
        <DisplayPanelSettingsPanel slug={slug} tenant={tenant} refresh={refreshTenant} />
      )}

      {activeTab === "downloads" && (
        <DownloadsPanel />
      )}

      {activeTab === "whatsapp" && (
        <div className="space-y-4">
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
      <StaffList tenant={tenant} />
      )}

      {activeTab === "inventory" && (
      <InventoryPanel tenant={tenant} />
      )}

      {activeTab === "production" && (
        <ProductionPanel tenant={tenant} />
      )}
      {activeTab === "suppliers" && (
        <SuppliersPanel tenant={tenant} />
      )}

      {activeTab === "tables" && (
        <div className="space-y-4">
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

  return fullBleed ? content : <PageWrapper className="px-0 sm:px-0 lg:px-0 xl:px-0">{content}</PageWrapper>;
}
