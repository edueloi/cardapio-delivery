export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  whatsapp?: string;
  address?: string;
  categories?: Category[];
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
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  status: 'PENDING' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  orderType: 'DELIVERY' | 'PICKUP';
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
