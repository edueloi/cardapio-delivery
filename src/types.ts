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

export interface KmRange {
  id: string;
  upToKm: number;   // upper bound in km (exclusive), e.g. 5 means "up to 5 km"
  fee: number;      // delivery fee in BRL for this range
}

export interface DeliveryConfig {
  mode: "free" | "fixed" | "zones" | "km";
  fixedFee?: number;             // used when mode === "fixed"
  defaultFee?: number;           // fallback fee for unlisted CEPs when mode === "zones"
  allowUnlisted?: boolean;       // whether to accept orders from unlisted CEPs
  zones?: DeliveryZone[];
  // km mode fields
  originCep?: string;            // CEP of the store (origin for distance calculation)
  kmRanges?: KmRange[];          // sorted ascending by upToKm
  kmDefaultFee?: number;         // fee for orders beyond the last range (null = blocked)
  kmAllowBeyond?: boolean;       // whether to accept orders beyond last range
}

// Taxa da maquininha por bandeira. Para débito: installmentFees tem só a chave "1".
// Para crédito: installmentFees mapeia número de parcelas (1 a 12) -> percentual (%).
export interface BrandFeeConfig {
  installmentFees: Record<string, number>; // ex: { "1": 2.5, "2": 3.5, "3": 4.2 }
}

export interface PaymentMethodConfig {
  enabled: boolean;
  label: string;
  acceptedBrands?: string[];
  passFeeToCustomer?: boolean;               // repassa a taxa da maquininha ao cliente nesta forma de pagamento
  brandFees?: Record<string, BrandFeeConfig>; // chave = nome da bandeira (mesmo valor de acceptedBrands)
}

export interface ServiceChargeConfig {
  enabled: boolean;  // se true, a taxa vem pré-marcada no checkout do PDV (sempre desmarcável)
  percent: number;   // ex: 10 = 10% sobre o subtotal dos itens
}

export interface PaymentConfig {
  pix?: PaymentMethodConfig;
  credit?: PaymentMethodConfig;
  debit?: PaymentMethodConfig;
  meal?: PaymentMethodConfig; // Vale Refeição
  food?: PaymentMethodConfig; // Vale Alimentação
  cash?: {
    enabled: boolean;
    label: string;
    allowChange: boolean;
  };
  acceptedBrands?: string[];
  customBrands?: string[];
  serviceCharge?: ServiceChargeConfig;
}

// orderMode: DELIVERY_ONLY = só delivery imediato; PREORDER_ONLY = só encomenda; BOTH = os dois
export type OrderMode = "DELIVERY_ONLY" | "PREORDER_ONLY" | "BOTH";

// Valor sentinela usado no QR Code de "Balcão" (pedido sem mesa fixa) — pedidos criados a
// partir dele nascem com tableId=null e ganham counterTicketNumber (senha sequencial diária).
export const COUNTER_ORDER_TABLE_ID = "Balcao";

// Alguns pedidos antigos foram salvos com o label completo dentro de customerName
// (ex: "Balcão — Senha 01 — João" em vez de só "João") por um bug já corrigido.
// Aqui extraímos só o nome de verdade, pra não duplicar "Balcão — Senha" no rótulo.
export function cleanCustomerName(customerName?: string | null): string {
  if (!customerName) return "";
  const match = customerName.match(/—\s*([^—]+)$/);
  return (match ? match[1] : customerName).trim();
}

// Rótulo exibido nos painéis (Cozinha, Pedidos, PDV, Garçom) para um pedido DINE_IN:
// mesa numerada ("Mesa 5"), balcão com senha ("Senha 12 — João"), ou fallback.
export function dineInOrderLabel(order: { tableId?: string | null; counterTicketNumber?: number | null; customerName?: string }): string {
  if (order.counterTicketNumber != null) {
    const cleanName = cleanCustomerName(order.customerName);
    const isRedundant = cleanName.toLowerCase().startsWith("senha ") || cleanName.toLowerCase() === "venda pdv" || cleanName.toLowerCase().startsWith("balcão");
    const name = (cleanName && !isRedundant) ? ` — ${cleanName}` : "";
    return `Senha ${String(order.counterTicketNumber).padStart(2, "0")}${name}`;
  }
  if (order.tableId) return `Mesa ${order.tableId}`;
  return "Comanda";
}

// scheduleType: CLIENT_CHOOSES = cliente escolhe qualquer data; OWNER_DEFINES = estabelecimento define dias/horários fixos
export interface ScheduleDay {
  weekday: number;   // 0=Dom 1=Seg ... 6=Sáb
  label: string;     // "Segunda-feira"
  enabled: boolean;
  times: string[];   // ["09:00", "12:00", "18:00"]
}

// ProductScheduleRule: regra de visibilidade automática no cardápio público
export interface ProductScheduleRule {
  type: "weekday" | "daterange" | "both";
  weekdays?: number[];        // 0=Dom … 6=Sáb
  weekdayStartTime?: string;  // HH:mm — hora em que aparece no dia (omitir = 00:00)
  weekdayEndTime?: string;    // HH:mm — hora em que some no dia (omitir = 23:59)
  startDate?: string;         // YYYY-MM-DD — início do período
  endDate?: string;           // YYYY-MM-DD — fim do período (inclusive)
}

export interface StoneConfig {
  enabled: boolean;
  secretKey: string;    // sk_live_... or sk_test_... from Pagar.me
  stonecode: string;    // establishment code linking to physical terminal
}

// ─── Fiscal / NFC-e ──────────────────────────────────────────────────────────

export type FiscalRegime =
  | "1"  // Simples Nacional
  | "2"  // Simples Nacional — excesso de sublimite
  | "3"; // Regime Normal (Lucro Presumido / Real)

export interface FiscalConfig {
  enabled: boolean;
  ambiente: "homologacao" | "producao";
  // Emitente
  cnpj: string;
  ie: string;                // Inscrição Estadual
  im?: string;               // Inscrição Municipal (opcional)
  crt: FiscalRegime;         // Código de Regime Tributário
  // Certificado digital A1 (PFX base64)
  certBase64?: string;
  certPassword?: string;
  // NFC-e
  serie: number;             // Série da NFC-e (geralmente 1)
  proximoNumero: number;     // Próximo número sequencial
  csc: string;               // Código de Segurança do Contribuinte (token SEFAZ)
  cscId: string;             // ID do CSC cadastrado na SEFAZ
  // UF do emitente (ex: "SP")
  uf: string;
  // cMunFG: código IBGE do município (ex: 3550308 = São Paulo)
  cMun: string;
  xMun: string;
}

export type NfceStatus = "PENDING" | "AUTHORIZED" | "REJECTED" | "CANCELLED";

export interface NfceResult {
  status: NfceStatus;
  chave?: string;
  protocolo?: string;
  numero?: number;
  danfeUrl?: string;
  xmlAutorizado?: string;
  motivo?: string; // mensagem de erro/rejeição
}

export interface DanfeItem {
  name: string;
  quantity: number;
  unitCom: string;
  unitPrice: number;
  total: number;
}

// Dados prontos pro cupom fiscal (DANFE-NFC-e), devolvidos por
// GET /api/owner/tenants/:tenantId/nfce/danfe/:orderId
export interface DanfeData {
  emitName: string;
  emitCnpj: string;
  emitIe: string;
  emitAddress: string;
  ambiente: "homologacao" | "producao";
  numero: number;
  serie: number;
  chave: string;
  protocolo: string;
  dhEmi: string;
  dhRecbto?: string;
  items: DanfeItem[];
  total: number;
  paymentMethod: string;
  customerName?: string;
  customerCpf?: string;
  qrCodeUrl: string;
  consultaUrl: string;
  qrCodeDataUrl: string;
  isSimplesNacional: boolean;
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
  isDeliveryOpen?: boolean; // fechar só o delivery sem fechar o estabelecimento inteiro
  effectiveIsOpen?: boolean; // isOpen combinado com o horário de funcionamento (calculado no servidor)
  scheduleMode?: boolean;
  scheduleType?: "CLIENT_CHOOSES" | "OWNER_DEFINES";
  scheduleDays?: string | null;  // JSON: ScheduleDay[]
  scheduleNotes?: string | null;
  orderMode?: OrderMode;
  businessHours?: string | null;
  deliveryConfig?: string | null; // JSON string: DeliveryConfig
  paymentMethods?: string | null; // JSON string: PaymentConfig
  stoneConfig?: string | null;    // JSON string: StoneConfig
  fiscalConfig?: string | null;   // JSON string: FiscalConfig
  categories?: Category[];
  wppInstance?: WppInstance | null;
  wppBotConfig?: WppBotConfig | null;
  loyaltyConfig?: LoyaltyConfig | null;
  displayPanelConfig?: string | null; // JSON string: DisplayPanelConfig
  waiterNotifyOnReady?: boolean; // avisa o garçom quando a cozinha marca a comanda como pronta pra servir
  requireCashRegister?: boolean; // se false, PDV vende sem precisar abrir/fechar caixa
  receiptPaperWidth?: 58 | 80; // largura da bobina térmica (mm) usada no recibo do PDV
  printingConfig?: string | null; // JSON string: PrintingConfig
}

// Controla a impressão automática do PDV/comanda/mesa/delivery e do fechamento de caixa.
// Serializado como JSON string em Tenant.printingConfig — mesmo padrão de stoneConfig/fiscalConfig.
export interface PrintingConfig {
  autoPrintOnOrderCreate: boolean; // imprime sozinho ao criar pedido (PDV, comanda/mesa via QR Code, delivery)
  autoPrintEstablishmentCopy: boolean; // 2ª via (estabelecimento/cozinha) além da via do cliente, em PDV/comanda/mesa
  autoPrintCashClosingReport: boolean; // imprime o resumo de vendas ao fechar o caixa
}

export const DEFAULT_PRINTING_CONFIG: PrintingConfig = {
  autoPrintOnOrderCreate: true,
  autoPrintEstablishmentCopy: true,
  autoPrintCashClosingReport: true,
};

// Controla quais tipos de pedido aparecem no Painel TV (/:slug/display) — tela exposta pro cliente ver o status.
// Delivery não é "retirado", então por padrão fica de fora; o dono pode reativar se quiser.
export interface DisplayPanelConfig {
  showDelivery: boolean;  // pedidos com orderType === "DELIVERY"
  showPickup: boolean;    // pedidos com orderType === "TAKEAWAY" (retirada no balcão)
  showDineIn: boolean;    // pedidos com orderType === "DINE_IN" (mesa/salão)
  voiceAnnouncement?: boolean; // fala em voz alta "Pedido nº X, retire no balcão" quando fica pronto (default: true)
  // Visual
  theme?: "dark" | "light"; // default: "dark" (comportamento atual)
  preparingColor?: string;  // cor de destaque da coluna "Em Preparo" — hex, ex: "#ea580c"
  readyColor?: string;      // cor de destaque da coluna "Pronto" — hex, ex: "#22c55e"
  showLogo?: boolean;       // exibe o logo do tenant no cabeçalho (default: true)
  // Som e voz
  readySoundFile?: string;    // um dos arquivos em ALERT_SOUND_FILES (notificationSound.ts) — default: som_painel_cozinha.mp3
  voiceName?: string | null;  // nome exato da SpeechSynthesisVoice escolhida — null/undefined = escolha automática
  voiceText?: string;         // texto falado, com placeholder {numero} — default: "Senha número {numero}, retirar no balcão"
  // Carrossel de propaganda
  carouselEnabled?: boolean;       // default: true — se false ou sem imagens ativas, colunas ocupam a tela inteira
  carouselIntervalSeconds?: number; // segundos que cada imagem fica visível — default: 8
  // Layout
  minimalMode?: boolean;          // default: false — esconde cabeçalho e rodapé, sobra só as colunas de senha
  ticketCardSize?: "normal" | "large" | "xlarge"; // tamanho da senha nos cards das colunas — default: "normal"
  ticketCardSizePx?: number | null; // tamanho customizado em pixels da senha — quando definido, sobrepõe ticketCardSize (todos os estilos)
  cardStyle?: "floating" | "ticket" | "scoreboard" | "fastfood" | "grid" | "artesanal"; // visual do card de senha — default: "floating" (comportamento atual)
  // "grid" muda a estrutura da coluna inteira: em vez de um card por pedido, empilha os números
  // em colunas compactas dentro do mesmo bloco — estilo painel de lanchonete/drive-thru físico.
  // Estilo "Artesanal" — paleta própria (bege/marrom por padrão), diferente de
  // preparingColor/readyColor usados pelos outros 5 estilos. undefined = usa o padrão.
  artesanalCreamColor?: string | null;
  artesanalBrownColor?: string | null;
  artesanalShowQrFooter?: boolean; // default: true — mostra a faixa "Acesse nosso cardápio" com QR Code
}

// Uma imagem do carrossel de propaganda do Painel de Pedidos — tabela própria (não um
// array dentro de DisplayPanelConfig) pra permitir reordenar/ativar-desativar sem reescrever
// o JSON inteiro a cada mudança.
export interface DisplayPanelImage {
  id: string;
  tenantId: string;
  imageUrl: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
}

export interface LoyaltyConfig {
  id: string;
  tenantId: string;
  enabled: boolean;
  pointsPerReal: number;        // e.g. 1 point per R$ 1.00
  minPointsToRedeem: number;    // e.g. 50 points
  redemptionRatio: number;      // e.g. 0.10 (10 points = R$ 1.00)
  maxRedemptionValue?: number;  // max discount per order
}

export interface CustomerLoyalty {
  id: string;
  tenantId: string;
  customerPhone: string;
  points: number;
  totalSpent: number;
  ordersCount: number;
}

export interface IfoodConfig {
  enabled: boolean;
  merchantId: string | null;
  clientId: string | null;
  hasClientSecret?: boolean; // o backend nunca devolve o secret em texto puro
  autoAcceptOrders: boolean;
  status: "NOT_CONNECTED" | "PENDING_APPROVAL" | "CONNECTED" | "ERROR";
}

export interface Account {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
  birthDate?: string | null;
  isSuperAdmin?: boolean;
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
  sendLoyaltyPoints: boolean;
  sendReceiptPdf: boolean; // envia o recibo em PDF ao cliente quando o pedido é entregue
  sendLowStockAlert: boolean;
  ownerAlertPhone?: string | null; // telefone dedicado para alertas internos (novo pedido, estoque baixo) — se vazio, usa o whatsapp público do tenant
  welcomeMessage?: string | null;
  isPaused: boolean;
  startTime?: string | null;
  endTime?: string | null;
  preorderMessage?: string | null; // mensagem customizada para encomendas; suporta {nome}, {data}, {hora}, {total}
}

export type WppMessageKind =
  | "ORDER_CREATED" | "OWNER_ALERT" | "STATUS_UPDATE" | "LOYALTY_POINTS"
  | "LOW_STOCK" | "PREORDER" | "MANUAL_TEST" | "CONVERSATION" | "RECEIPT_PDF";

export interface WppMessageLog {
  id: string;
  tenantId: string;
  toPhone: string;
  kind: WppMessageKind;
  preview: string;
  sentAt: string;
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

export interface ProductExtra {
  id: string;       // uuid gerado no front
  label: string;    // "Gelo", "Limão", "Sem Cebola"
  price?: number;   // 0 = gratuito
  imageUrl?: string;
}

// Grupo de seleção embutido no produto — ex: "2 espetos tradicionais" (preço fixo)
// deixa o cliente escolher `qty` itens de uma categoria já existente (ou de uma lista
// manual de produtos), reaproveitando nome/foto/descrição de lá. Diferente de extras
// (adicionais opcionais com preço próprio) e diferente de combo/bundle (entidade
// separada com nome e preço dela mesma): aqui a escolha NUNCA muda o preço — o preço
// cobrado é sempre o do produto pai.
export interface ProductSelectionGroup {
  sourceType: "category" | "products";
  categoryId?: string;   // se sourceType === "category"
  productIds?: string[]; // se sourceType === "products"
  qty: number;            // quantos itens o cliente deve escolher
  label?: string;         // rótulo mostrado ao cliente, ex: "Escolha os 2 sabores"
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  categoryId: string;
  available: boolean;
  pdvOnly?: boolean;
  kitchenPrint?: boolean; // false = não aparece no painel de cozinha (ex: bebidas, embalagens)
  autoDisableWhenOutOfStock?: boolean;
  inventoryItemId?: string | null;
  inventoryItem?: InventoryItem | null;
  variants?: ProductVariant[];
  extras?: string | null; // JSON: ProductExtra[]
  selectionGroup?: string | null; // JSON: ProductSelectionGroup
  scheduleRule?: string | null; // JSON: ProductScheduleRule
  // Fiscal NFC-e
  ncm?: string | null;
  cfop?: string | null;
  csosn?: string | null;
  unitCom?: string | null;
  origem?: number;
  aliqIcms?: number;
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
  // Conversão inteligente de unidades
  // Ex: purchaseUnit="un", purchaseQty=1000, stockUnit="ml"
  // → 1 garrafa comprada = 1000 ml no estoque granular
  purchaseUnit?: string | null;  // unidade de compra (un, cx, fardo…)
  purchaseQty?: number | null;   // conteúdo por unidade de compra (ex: 1000)
  stockUnit?: string | null;     // unidade granular usada na produção (ml, g…)
}

export interface ProductionRecipeIngredient {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes?: string | null;
}

export type ProductionOverheadType =
  | "ENERGIA"
  | "AGUA"
  | "GAS"
  | "MAO_DE_OBRA"
  | "EMBALAGEM"
  | "OUTROS";

export type ProductionOverheadMode = "PER_RECIPE" | "PER_OUTPUT_UNIT";

export interface ProductionRecipeOverhead {
  id: string;
  label: string;
  type: ProductionOverheadType;
  cost: number;
  calculationMode: ProductionOverheadMode;
  notes?: string | null;
}

export interface ProductionOutputSnapshot {
  inventoryItemId?: string | null;
  inventoryItemName?: string | null;
  productId?: string | null;
  productName?: string | null;
  requestedQuantity: number;
  requestedUnit: string;
  convertedQuantity: number | null;
  inventoryUnit?: string | null;
  stockBefore?: number | null;
  stockAfter?: number | null;
  unitCostApplied?: number | null;
  canRestock: boolean;
  message?: string | null;
}

export interface ProductionRunIngredientSnapshot extends ProductionRecipeIngredient {
  inventoryUnit: string;
  requestedQuantity: number;
  convertedQuantity: number | null;
  stockBefore: number;
  stockAfter: number;
  unitCost: number;
  totalCost: number;
  shortageQuantity: number;
  canConvert: boolean;
  available: boolean;
  message?: string | null;
}

export interface ProductionRunOverheadSnapshot extends ProductionRecipeOverhead {
  totalCost: number;
}

export interface ProductionRecipe {
  id: string;
  tenantId: string;
  productId?: string | null;
  name: string;
  description?: string | null;
  outputQuantity: number;
  outputUnit: string;
  instructions?: string | null;
  ingredients: ProductionRecipeIngredient[];
  overheads: ProductionRecipeOverhead[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  product?: Product | null;
}

export interface ProductionRun {
  id: string;
  tenantId: string;
  recipeId?: string | null;
  recipeName: string;
  batchCode: string;
  quantityProduced: number;
  unit: string;
  notes?: string | null;
  createdByName?: string | null;
  totalIngredientCost: number;
  totalOverheadCost: number;
  totalCost: number;
  costPerOutput: number;
  ingredientsSnapshot: ProductionRunIngredientSnapshot[];
  overheadsSnapshot: ProductionRunOverheadSnapshot[];
  outputSnapshot?: ProductionOutputSnapshot | null;
  createdAt: string;
  recipe?: ProductionRecipe | null;
}

export interface ProductionSimulation {
  factor: number;
  quantityProduced: number;
  outputUnit: string;
  totalIngredientCost: number;
  totalOverheadCost: number;
  totalCost: number;
  costPerOutput: number;
  hasIssues: boolean;
  missingItems: number;
  ingredients: ProductionRunIngredientSnapshot[];
  overheads: ProductionRunOverheadSnapshot[];
  outputSnapshot?: ProductionOutputSnapshot | null;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  inventoryItemId?: string | null;
  inventoryItem?: InventoryItem | null;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  address?: string;
  status: 'PENDING' | 'PREPARING' | 'SHIPPED' | 'AWAITING_PAYMENT' | 'DELIVERED' | 'CANCELLED' | 'MERGED';
  orderType: 'DELIVERY' | 'PICKUP' | 'DINE_IN';
  tableId?: string | null;
  counterTicketNumber?: number | null; // senha sequencial diária — só para pedidos de balcão (sem mesa)
  kitchenReady?: boolean;
  paymentMethod: 'PIX' | 'CREDIT' | 'DEBIT' | 'MEAL' | 'FOOD' | 'CASH' | 'VR' | 'SPLIT' | 'STONE_CREDIT' | 'STONE_DEBIT' | 'STONE_PIX';
  paymentDetail?: string;
  scheduledDate?: string | null; // ISO date string YYYY-MM-DD
  scheduledTime?: string | null; // HH:mm
  notes?: string | null;
  total: number;
  tenantId: string;
  createdAt: string;
  updatedAt?: string; // atualizado a cada mudança de status — usado pra saber há quanto tempo o pedido está no status atual
  readyAt?: string | null; // quando ficou pronto na cozinha/SHIPPED — usado pra saber há quanto tempo está aguardando retirada
  items: OrderItem[];
  operatorName?: string | null;
  customerId?: string | null;
  // NFC-e
  nfceKey?: string | null;
  nfceStatus?: NfceStatus | null;
  nfceProtocol?: string | null;
  nfceNumber?: number | null;
  customerCpf?: string | null;
  // Taxa de maquininha
  feeAmount?: number | null;      // valor da taxa cobrada pela adquirente (custo)
  feePercent?: number | null;     // percentual aplicado (bandeira + parcelas)
  feePassedToCustomer?: boolean;  // se true, feeAmount já está somado em total
  // Taxa de serviço (opcional, ex: 10% em mesas)
  serviceFeeAmount?: number | null;
  serviceFeePercent?: number | null;
  billed?: boolean; // true quando já existe lançamento de caixa (CashMovement) pra este pedido
}

export interface OrderItem {
  id: string;
  productId: string;
  productVariantId?: string;
  quantity: number;
  price: number;
  notes?: string;
  product?: Product;
  productVariant?: ProductVariant | null;
}

export interface Comanda {
  id: string;
  tenantId: string;
  number: string;      // The physical card number or name
  customerName?: string;
  tableId?: string;    // Optional link to a table
  status: 'OPEN' | 'CLOSED';
  total: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
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
  operatorName?: string | null;
  openedByName?: string | null;
  openedByEmail?: string | null;
  closedByName?: string | null;
  closedByEmail?: string | null;
}

export interface CashMovementOrderItem {
  productName: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

export interface CashMovementOrder {
  id: string;
  grossTotal: number;       // soma dos itens antes de desconto/taxa
  discount: number;
  discountType?: string | null; // PERCENT | FIXED
  feeAmount: number;        // taxa de maquininha
  feePercent?: number | null;
  feePassedToCustomer: boolean;
  serviceFeeAmount: number; // taxa de serviço (ex: 10% mesa)
  serviceFeePercent?: number | null;
  total: number;            // valor final do pedido
  items: CashMovementOrderItem[];
}

export interface CashMovement {
  id: string;
  cashRegisterId: string;
  tenantId: string;
  type: string;
  amount: number;
  description?: string | null;
  orderId?: string | null;
  operatorName?: string | null;
  createdAt: string;
  order?: CashMovementOrder | null;
}

// ─── Product Bundles / Combos ─────────────────────────────────────────────────
// Um BundleStep representa uma etapa de escolha no combo (ex: "Escolha a pizza", "Escolha o refri")
// flavorMode: "single" = só um sabor; "half" = dois sabores (meio a meio) — somente para pizza
// sourceType: "category" = lista produtos de uma categoria; "products" = lista selecionada manualmente
export interface BundleStep {
  id: string;           // uuid client-side
  label: string;        // "Escolha a Pizza Grande"
  description?: string; // opcional
  sourceType: "category" | "products";
  categoryId?: string;  // se sourceType === "category"
  productIds?: string[]; // se sourceType === "products"
  variantId?: string;    // variante obrigatória (ex: só "Grande")
  flavorMode: "single" | "half"; // "half" = meio a meio (2 sabores)
  qty: number;           // quantas unidades desta etapa compõem o combo
  required: boolean;
}

export interface ProductBundle {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  available: boolean;
  sortOrder: number;
  steps: BundleStep[];  // JSON serializado no banco
  createdAt: string;
  updatedAt: string;
}

// Seleção do usuário em cada etapa
export interface BundleStepSelection {
  stepId: string;
  stepLabel: string;
  flavorMode: "single" | "half";
  qty: number;
  // single: um produto+variante
  productId?: string;
  productName?: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  // half: dois produtos
  halfA?: { productId: string; productName: string; variantId?: string; variantName?: string };
  halfB?: { productId: string; productName: string; variantId?: string; variantName?: string };
  // single com qty > 1 (ex: "2 espetos tradicionais"): um sabor independente por unidade.
  // productId/productName acima ficam com a 1ª unidade por compatibilidade; "multi" tem todas.
  multi?: { productId: string; productName: string; variantId?: string; variantName?: string }[];
}

export interface BundleCartItem {
  type: "bundle";
  bundle: ProductBundle;
  selections: BundleStepSelection[];
  quantity: number;
  notes: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string | null;
  cpf?: string | null;
  address?: string | null;
  notes?: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  ordersCount: number;
  lastOrderAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SupplierType =
  | "ALIMENTICIO"
  | "BEBIDAS"
  | "EMBALAGENS"
  | "LIMPEZA"
  | "EQUIPAMENTOS"
  | "OUTROS";

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  cpfCnpj?: string | null;
  type: SupplierType;
  phone?: string | null;
  email?: string | null;
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  notes?: string | null;
  isFavorite: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  inventoryItems?: SupplierInventoryItemLink[];
  _count?: { catalogItems: number };
}

export interface SupplierInventoryItemLink {
  id: string;
  supplierId: string;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
}

export interface SupplierCatalogItem {
  id: string;
  supplierId: string;
  name: string;
  unit?: string | null;
  price?: number | null;
  notes?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
