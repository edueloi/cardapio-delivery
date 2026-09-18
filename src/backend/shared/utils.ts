// Helpers utilitários sem estado, compartilhados por vários módulos de rotas.
// Movidos de server.ts sem qualquer alteração de comportamento.

export function sanitizeSlug(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeEmail(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function normalizeUsername(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

export function serializeAccount(account: any) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    username: account.username ?? null,
    phone: account.phone ?? null,
    address: account.address ?? null,
    avatarUrl: account.avatarUrl ?? null,
    birthDate: account.birthDate
      ? new Date(account.birthDate).toISOString().slice(0, 10)
      : null,
    isSuperAdmin: !!account.isSuperAdmin,
  };
}

export function cuid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

export function isProductActiveNow(scheduleRule: string | null): boolean {
  if (!scheduleRule) return true;
  try {
    const rule = JSON.parse(scheduleRule) as {
      type: string;
      weekdays?: number[];
      weekdayStartTime?: string;
      weekdayEndTime?: string;
      startDate?: string;
      endDate?: string;
    };
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );
    const todayWeekday = now.getDay();
    const todayStr = now.toISOString().split("T")[0];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const checkWeekday = (): boolean => {
      if (!rule.weekdays || rule.weekdays.length === 0) return false;
      if (!rule.weekdays.includes(todayWeekday)) return false;
      const startMin = rule.weekdayStartTime
        ? parseInt(rule.weekdayStartTime.split(":")[0]) * 60 +
          parseInt(rule.weekdayStartTime.split(":")[1])
        : 0;
      const endMin = rule.weekdayEndTime
        ? parseInt(rule.weekdayEndTime.split(":")[0]) * 60 +
          parseInt(rule.weekdayEndTime.split(":")[1])
        : 23 * 60 + 59;
      return nowMinutes >= startMin && nowMinutes <= endMin;
    };

    const checkDaterange = (): boolean => {
      if (!rule.startDate || !rule.endDate) return false;
      return todayStr >= rule.startDate && todayStr <= rule.endDate;
    };

    if (rule.type === "weekday") return checkWeekday();
    if (rule.type === "daterange") return checkDaterange();
    if (rule.type === "both") return checkWeekday() && checkDaterange();
    return true;
  } catch {
    return true;
  }
}

const BUSINESS_HOURS_DAY_KEYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

// Checa se o horário atual cai dentro do funcionamento configurado (businessHours) —
// sem config salva, considera sempre aberto (não força fechamento por omissão).
export function isWithinBusinessHours(businessHours: string | null): boolean {
  if (!businessHours) return true;
  try {
    const hours = JSON.parse(businessHours) as Record<
      string,
      {
        enabled: boolean;
        open: string;
        close: string;
        breakEnabled?: boolean;
        breakStart?: string;
        breakEnd?: string;
      }
    >;
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );
    const dayKey = BUSINESS_HOURS_DAY_KEYS[now.getDay()];
    const today = hours[dayKey];
    if (!today || !today.enabled) return false;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    const openMin = toMinutes(today.open || "00:00");
    const closeMin = toMinutes(today.close || "23:59");
    if (nowMinutes < openMin || nowMinutes > closeMin) return false;

    if (today.breakEnabled && today.breakStart && today.breakEnd) {
      const breakStartMin = toMinutes(today.breakStart);
      const breakEndMin = toMinutes(today.breakEnd);
      if (nowMinutes >= breakStartMin && nowMinutes <= breakEndMin)
        return false;
    }

    return true;
  } catch {
    return true;
  }
}

// Haversine distance between two lat/lng points in km
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode a CEP using the public nominatim API (no key required)
export async function geocodeCep(
  cep: string
): Promise<{ lat: number; lng: number } | null> {
  const digits = cep.replace(/\D/g, "");
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${digits}&country=BR&format=json&limit=1`;
    const r = await fetch(url, {
      headers: { "User-Agent": "cardapio-delivery-app/1.0" },
    });
    const data = (await r.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export function fmtBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

// Pedido de Balcão/Mesa pago fica com status AWAITING_PAYMENT (ou PREPARING, se pago
// adiantado) pra sempre — faturar no PDV muda só o campo "billed", nunca o status
// (só Delivery normalmente chega a DELIVERED). Filtrar relatório/resumo financeiro só por
// status === "DELIVERED" escondia toda essa receita — usar esse fragmento de "where" do
// Prisma em qualquer consulta que precise contar pedidos como "venda concluída de verdade".
export const CONCLUDED_SALE_OR = [
  { status: "DELIVERED" },
  { billed: true, status: { not: "CANCELLED" } },
];

// Pagamento dividido ("Dividir Pagamento" no PDV) grava o pedido com
// paymentMethod="SPLIT" e o detalhamento real (ex: Pix + Dinheiro) dentro de
// paymentDetail.splits. Sem decompor isso, todo relatório por forma de pagamento
// jogava o valor inteiro num balde genérico "SPLIT", que não bate com o
// dinheiro/cartão físico que realmente entrou no caixa.
export function splitPaymentBreakdown(
  paymentMethod: string,
  paymentDetail: string | null,
  total: number
): Array<{ method: string; amount: number }> {
  if (paymentMethod === "SPLIT" && paymentDetail) {
    try {
      const detail = JSON.parse(paymentDetail);
      if (Array.isArray(detail.splits) && detail.splits.length > 0) {
        return detail.splits.map((s: any) => ({ method: s.method, amount: s.amount }));
      }
    } catch {
      /* paymentDetail inválido — cai no fallback abaixo */
    }
  }
  return [{ method: paymentMethod, amount: total }];
}

// Espelho de splitPaymentBreakdown na hora de GRAVAR o CashMovement (em vez de só
// interpretar depois): sem isso, uma venda com "Dividir Pagamento" virava um único
// registro type="PAYMENT_SPLIT" — a tela de Fluxo de Caixa não reconhece esse tipo,
// então o valor sumia dos cards por método (mas continuava contando no total geral,
// caixa parecia "não bater"). Gerando uma linha por método real (PAYMENT_CREDIT,
// PAYMENT_DEBIT etc.) o extrato já nasce correto, sem precisar decompor na leitura.
export function buildPaymentCashMovements(opts: {
  cashRegisterId: string;
  tenantId: string;
  paymentMethod: string;
  splits?: Array<{ method: string; amount: number }> | null;
  fallbackAmount: number;
  description: string;
  orderId: string;
  operatorName?: string | null;
}): Array<{
  cashRegisterId: string;
  tenantId: string;
  type: string;
  amount: number;
  description: string;
  orderId: string;
  operatorName: string | null;
}> {
  const { cashRegisterId, tenantId, paymentMethod, splits, fallbackAmount, description, orderId, operatorName } = opts;
  if (paymentMethod === "SPLIT" && Array.isArray(splits) && splits.length > 0) {
    return splits.map((s) => ({
      cashRegisterId,
      tenantId,
      type: `PAYMENT_${s.method}`,
      amount: s.amount,
      description,
      orderId,
      operatorName: operatorName || null,
    }));
  }
  return [
    {
      cashRegisterId,
      tenantId,
      type: `PAYMENT_${paymentMethod || "CASH"}`,
      amount: fallbackAmount,
      description,
      orderId,
      operatorName: operatorName || null,
    },
  ];
}
