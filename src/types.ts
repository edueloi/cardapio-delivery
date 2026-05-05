export interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
  breakEnabled?: boolean;
  breakStart?: string;
  breakEnd?: string;
}

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type BusinessHours = Partial<Record<DayKey, DaySchedule>>;

export interface DeliveryZone {
  id: string;
  label: string;      // e.g. "Centro", "Bairro Norte"
  ceps: string[];     // prefixes or full CEPs, e.g. ["18040", "18041"]
  fee: number;        // in BRL
}

export interface DeliveryConfig {
  mode: "free" | "fixed" | "zones";
  fixedFee?: number;             // used when mode === "fixed"
  defaultFee?: number;           // fallback fee for unlisted CEPs when mode === "zones"
  allowUnlisted?: boolean;       // whether to accept orders from unlisted CEPs
  zones?: DeliveryZone[];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  whatsapp?: string;
  address?: string;
  isOpen?: boolean;
  businessHours?: string | null;
  deliveryConfig?: string | null; // JSON string: DeliveryConfig
  categories?: Category[];
  wppInstance?: WppInstance | null;
  wppBotConfig?: WppBotConfig | null;
}

export interface Account {
  id: string;
  name: string;
  email: string;
}

export interface TenantMembership {
  membershipId: string;
  role: string;
  tenant: Tenant;
}

export interface AuthPayload {
  token: string;
  account: Account;
  tenants: TenantMembership[];
}

export interface WppInstance {
  id: string;
  tenantId: string;
  instanceName: string;
  phone?: string | null;
  status: string;
  qrCode?: string | null;
  isActive: boolean;
}

export interface WppBotConfig {
  id: string;
  tenantId: string;
  botEnabled: boolean;
  autoReplyEnabled: boolean;
  sendOrderCreated: boolean;
  sendStatusUpdates: boolean;
  welcomeMessage?: string | null;
}

export interface WppSessionInfo {
  tenantId: string;
  status: string;
  phone?: string | null;
  qrCode?: string | null;
  qrDataUrl?: string | null;
}

export interface Category {
  id: string;
  name: string;
  products: Product[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  categoryId: string;
  available: boolean;
  autoDisableWhenOutOfStock?: boolean;
  inventoryItemId?: string | null;
  inventoryItem?: InventoryItem | null;
  variants?: ProductVariant[];
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  categoryId?: string | null;
  code?: string | null;
  name: string;
  brand?: string | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  quantity: number;
  minStock?: number | null;
  unit?: string | null;
  usage: 'SALE' | 'INTERNAL';
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  description?: string;
  price: number;
  inventoryItemId?: string | null;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  status: 'PENDING' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  orderType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  tableId?: string;
  paymentMethod: 'PIX' | 'CREDIT' | 'DEBIT' | 'MEAL' | 'CASH';
  paymentDetail?: string;
  total: number;
  tenantId: string;
  createdAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  productId: string;
  productVariantId?: string;
  quantity: number;
  price: number;
  notes?: string;
  product?: Product;
}

export interface CashRegister {
  id: string;
  tenantId: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  expectedBalance?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
}
