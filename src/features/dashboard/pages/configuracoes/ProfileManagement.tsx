import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  AlertCircle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Clock3,
  CreditCard,
  FileText,
  FileDown,
  FlaskConical,
  Info,
  MapPin,
  Monitor,
  Package,
  PackageCheck,
  Plus,
  QrCode,
  Rocket,
  Ruler,
  Smartphone,
  Sparkles,
  Store,
  Ticket,
  Trash2,
  Truck,
  User,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import {
  Button,
  ContentCard,
  FilterLineSegmented,
  Input,
  PageWrapper,
  Select,
  SectionTitle,
  Switch,
  Textarea,
  useToast,
} from "../../../../components";
import { apiJson } from "../../../../lib/api";
import {
  DeliveryConfig,
  DEFAULT_PRINTING_CONFIG,
  FiscalConfig,
  KmRange,
  PaymentConfig,
  PaymentMethodConfig,
  PrintingConfig,
  StoneConfig,
  Tenant,
} from "../../../../types";
import {
  buildAddressString,
  CARD_BRANDS_LIST,
  CondominiumsCard,
  DAY_KEYS_UI,
  DAY_LABELS,
  DEFAULT_HOURS,
  DEFAULT_PAYMENTS,
  DesktopPrinterSettings,
  EMPTY_ADDR,
  ImageUploader,
  KitchenAccessRequestsCard,
  KitchenPasswordCard,
  KitchenStaffCard,
  KmRangeAdder,
  maskPhone,
  parseAddress,
  parseScheduleDays,
  TimeInput,
  type AddressForm,
  unmaskPhone,
  ZoneAdder,
  fmt,
} from "../_shared/ManagementShared";

// Campo livre de UF na Localização deixava o usuário digitar "São Paulo" e travar
// em "SÃ" (o onChange truncava pros 2 primeiros caracteres a cada tecla, sem
// limpar o campo antes) — um dropdown com os códigos oficiais elimina isso de vez.
const UF_OPTIONS = [
  { value: "AC", label: "AC — Acre" },
  { value: "AL", label: "AL — Alagoas" },
  { value: "AP", label: "AP — Amapá" },
  { value: "AM", label: "AM — Amazonas" },
  { value: "BA", label: "BA — Bahia" },
  { value: "CE", label: "CE — Ceará" },
  { value: "DF", label: "DF — Distrito Federal" },
  { value: "ES", label: "ES — Espírito Santo" },
  { value: "GO", label: "GO — Goiás" },
  { value: "MA", label: "MA — Maranhão" },
  { value: "MT", label: "MT — Mato Grosso" },
  { value: "MS", label: "MS — Mato Grosso do Sul" },
  { value: "MG", label: "MG — Minas Gerais" },
  { value: "PA", label: "PA — Pará" },
  { value: "PB", label: "PB — Paraíba" },
  { value: "PR", label: "PR — Paraná" },
  { value: "PE", label: "PE — Pernambuco" },
  { value: "PI", label: "PI — Piauí" },
  { value: "RJ", label: "RJ — Rio de Janeiro" },
  { value: "RN", label: "RN — Rio Grande do Norte" },
  { value: "RS", label: "RS — Rio Grande do Sul" },
  { value: "RO", label: "RO — Rondônia" },
  { value: "RR", label: "RR — Roraima" },
  { value: "SC", label: "SC — Santa Catarina" },
  { value: "SP", label: "SP — São Paulo" },
  { value: "SE", label: "SE — Sergipe" },
  { value: "TO", label: "TO — Tocantins" },
];

export function ProfileManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"general" | "hours" | "delivery" | "payments" | "maquinhas" | "fiscal">("general");
  const [form, setForm] = useState({
    name: tenant?.name || "",
    description: tenant?.description || "",
    logoUrl: tenant?.logoUrl || "",
    whatsapp: maskPhone(tenant?.whatsapp) || "",
    isOpen: tenant?.isOpen ?? true,
    isDeliveryOpen: tenant?.isDeliveryOpen ?? true,
    counterTicketMode: (tenant?.counterTicketMode ?? "TICKET") as "TICKET" | "NAME",
    orderMode: (tenant?.orderMode ?? "DELIVERY_ONLY") as "DELIVERY_ONLY" | "PREORDER_ONLY" | "BOTH",
    scheduleMode: tenant?.scheduleMode ?? false,
    scheduleType: (tenant?.scheduleType ?? "CLIENT_CHOOSES") as "CLIENT_CHOOSES" | "OWNER_DEFINES",
    scheduleNotes: tenant?.scheduleNotes || "",
    waiterNotifyOnReady: tenant?.waiterNotifyOnReady ?? true,
    requireCashRegister: tenant?.requireCashRegister ?? true,
    receiptPaperWidth: (tenant?.receiptPaperWidth ?? 80) as 58 | 80,
  });
  const [scheduleDays, setScheduleDays] = useState<any[]>(() => parseScheduleDays(tenant?.scheduleDays));
  const [addr, setAddr] = useState<AddressForm>(() => parseAddress(tenant?.address) ?? { ...EMPTY_ADDR });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [hours, setHours] = useState<Record<string, { enabled: boolean; open: string; close: string; breakEnabled?: boolean; breakStart?: string; breakEnd?: string }>>(() => {
    try { return tenant?.businessHours ? JSON.parse(tenant.businessHours) : DEFAULT_HOURS; } catch { return DEFAULT_HOURS; }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const parseDeliveryConfig = (raw?: string | null): DeliveryConfig => {
    try { return raw ? JSON.parse(raw) : { mode: "free" }; } catch { return { mode: "free" }; }
  };

  const [delivery, setDelivery] = useState<DeliveryConfig>(() => parseDeliveryConfig(tenant?.deliveryConfig));

  const [payments, setPayments] = useState<PaymentConfig>(() => {
    try { return tenant?.paymentMethods ? JSON.parse(tenant.paymentMethods) : DEFAULT_PAYMENTS; } catch { return DEFAULT_PAYMENTS; }
  });

  const DEFAULT_STONE: StoneConfig = { enabled: false, secretKey: "", stonecode: "" };
  const [stone, setStone] = useState<StoneConfig>(() => {
    try { return tenant?.stoneConfig ? JSON.parse(tenant.stoneConfig) : DEFAULT_STONE; } catch { return DEFAULT_STONE; }
  });

  const DEFAULT_FISCAL: FiscalConfig = {
    enabled: false, ambiente: "homologacao", cnpj: "", ie: "", crt: "1",
    serie: 1, proximoNumero: 1, csc: "", cscId: "1", uf: "SP", cMun: "3550308", xMun: "São Paulo",
  };
  const [fiscal, setFiscal] = useState<FiscalConfig>(() => {
    try { return tenant?.fiscalConfig ? JSON.parse(tenant.fiscalConfig) : DEFAULT_FISCAL; } catch { return DEFAULT_FISCAL; }
  });

  const [printing, setPrinting] = useState<PrintingConfig>(() => {
    try { return tenant?.printingConfig ? { ...DEFAULT_PRINTING_CONFIG, ...JSON.parse(tenant.printingConfig) } : DEFAULT_PRINTING_CONFIG; }
    catch { return DEFAULT_PRINTING_CONFIG; }
  });

  useEffect(() => {
    if (tenant) {
      setForm({ name: tenant.name || "", description: tenant.description || "", logoUrl: tenant.logoUrl || "", whatsapp: maskPhone(tenant.whatsapp) || "", isOpen: tenant.isOpen ?? true, isDeliveryOpen: tenant.isDeliveryOpen ?? true, counterTicketMode: (tenant.counterTicketMode ?? "TICKET") as "TICKET" | "NAME", orderMode: (tenant.orderMode ?? "DELIVERY_ONLY") as "DELIVERY_ONLY" | "PREORDER_ONLY" | "BOTH", scheduleMode: tenant.scheduleMode ?? false, scheduleType: (tenant.scheduleType ?? "CLIENT_CHOOSES") as "CLIENT_CHOOSES" | "OWNER_DEFINES", scheduleNotes: tenant.scheduleNotes || "", waiterNotifyOnReady: tenant.waiterNotifyOnReady ?? true, requireCashRegister: tenant.requireCashRegister ?? true, receiptPaperWidth: (tenant.receiptPaperWidth ?? 80) as 58 | 80 });
      setScheduleDays(parseScheduleDays(tenant.scheduleDays));
      try { setPrinting(tenant.printingConfig ? { ...DEFAULT_PRINTING_CONFIG, ...JSON.parse(tenant.printingConfig) } : DEFAULT_PRINTING_CONFIG); } catch { setPrinting(DEFAULT_PRINTING_CONFIG); }
      setAddr(parseAddress(tenant.address) ?? { ...EMPTY_ADDR });
      try { setHours(tenant.businessHours ? JSON.parse(tenant.businessHours) : DEFAULT_HOURS); } catch { setHours(DEFAULT_HOURS); }
      setDelivery(parseDeliveryConfig(tenant.deliveryConfig));
      try { setPayments(tenant.paymentMethods ? JSON.parse(tenant.paymentMethods) : DEFAULT_PAYMENTS); } catch { setPayments(DEFAULT_PAYMENTS); }
      try { setStone(tenant.stoneConfig ? JSON.parse(tenant.stoneConfig) : DEFAULT_STONE); } catch { setStone(DEFAULT_STONE); }
      try { setFiscal(tenant.fiscalConfig ? JSON.parse(tenant.fiscalConfig) : DEFAULT_FISCAL); } catch { setFiscal(DEFAULT_FISCAL); }
    }
  }, [tenant]);

  const fetchCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { setCepError("CEP não encontrado."); return; }
      setAddr(a => ({ ...a, cep: digits, street: data.logradouro || a.street, neighborhood: data.bairro || a.neighborhood, city: data.localidade || a.city, state: data.uf || a.state, country: "Brasil" }));
    } catch { setCepError("Erro ao buscar CEP."); }
    finally { setCepLoading(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await apiJson(`/api/owner/tenants/${tenant?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          whatsapp: unmaskPhone(form.whatsapp),
          address: JSON.stringify(addr),
          businessHours: JSON.stringify(hours),
          deliveryConfig: JSON.stringify(delivery),
          paymentMethods: JSON.stringify(payments),
          stoneConfig: JSON.stringify(stone),
          fiscalConfig: JSON.stringify(fiscal),
          printingConfig: JSON.stringify(printing),
          scheduleDays: JSON.stringify(scheduleDays),
        })
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const setDay = (day: string, field: string, value: any) =>
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }));

  const setA = (field: keyof AddressForm, value: string) => setAddr(a => ({ ...a, [field]: value }));

  return (
    <PageWrapper>
      <SectionTitle
        title="Configurações"
        description="Dados da loja, funcionamento e integrações de pagamento"
        icon={Store}
        divider
        className="mb-5"
      />

      <div className="mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <div className="flex gap-1 border-b border-slate-200 w-max min-w-full sm:w-fit sm:min-w-0">
          {[
            { id: "general", label: "Loja", icon: Store },
            { id: "hours", label: "Horários", icon: Clock3 },
            { id: "delivery", label: "Entrega", icon: Truck },
            { id: "payments", label: "Pagamentos", icon: Wallet },
            { id: "maquinhas", label: "Maquininhas", icon: Smartphone },
            { id: "fiscal", label: "Fiscal", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold transition-colors shrink-0 border-b-2 -mb-px ${
                activeTab === tab.id ? 'border-[#0D1B3E] text-[#0D1B3E]' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon className="w-4 h-4" strokeWidth={2} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleUpdate} className="space-y-6">
        {activeTab === "general" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContentCard padding="lg">
              <SectionTitle title="Identidade" icon={Store} divider className="mb-5" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <ImageUploader label="Logo / Imagem da Unidade" value={form.logoUrl} onChange={(val) => setForm({...form, logoUrl: val})} description="Aparecerá no topo do cardápio digital." />
                <div className="space-y-4">
                  <Input label="Nome do estabelecimento" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Pastel do Edu" />
                  <Input label="WhatsApp de contato" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: maskPhone(e.target.value)})} placeholder="(00) 00000-0000" hint="Digite apenas o DDD + Número" />
                </div>
              </div>
              <Input label="Slogan / Descrição curta" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Ex: Os melhores pastéis da cidade" />
            </ContentCard>

            <ContentCard padding="lg">
              <SectionTitle title="Localização" icon={MapPin} divider className="mb-5" />
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <Input
                    label="CEP"
                    value={addr.cep}
                    onChange={e => { setA("cep", e.target.value); setCepError(""); }}
                    onBlur={e => fetchCep(e.target.value)}
                    placeholder="00000-000"
                    wrapperClassName="w-full sm:w-44"
                    error={cepError || undefined}
                  />
                  <Button type="button" variant="outline" size="sm" loading={cepLoading}
                    onClick={() => fetchCep(addr.cep)} className="w-full sm:w-auto mb-0.5">
                    Buscar CEP
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Logradouro" value={addr.street} onChange={e => setA("street", e.target.value)} placeholder="Rua, Av, Travessa..." wrapperClassName="md:col-span-2" />
                  <Input label="Número" value={addr.number} onChange={e => setA("number", e.target.value)} placeholder="123" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Complemento" value={addr.complement} onChange={e => setA("complement", e.target.value)} placeholder="Apto, Sala, Bloco..." />
                  <Input label="Bairro" value={addr.neighborhood} onChange={e => setA("neighborhood", e.target.value)} placeholder="Bairro" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Cidade" value={addr.city} onChange={e => setA("city", e.target.value)} placeholder="Cidade" />
                  <Select
                    label="Estado (UF)"
                    value={addr.state}
                    onChange={e => setA("state", e.target.value)}
                    options={UF_OPTIONS}
                    placeholder="Selecione..."
                  />
                  <Input label="País" value={addr.country} onChange={e => setA("country", e.target.value)} placeholder="Brasil" />
                </div>
              </div>

              {/* Preview */}
              {(addr.street || addr.city) && (
                <div className="mt-4 flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-500 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  {buildAddressString(addr)}
                </div>
              )}
            </ContentCard>

            <ContentCard padding="lg">
              <SectionTitle title="Status do Estabelecimento" icon={Info} divider className="mb-1" />
              <div className="divide-y divide-slate-100 space-y-0">
                <div className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Loja Aberta</p>
                    <p className="text-xs text-slate-500 mt-1">Forçar fechamento imediato do cardápio digital.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-semibold ${form.isOpen ? 'text-emerald-600' : 'text-red-500'}`}>
                      {form.isOpen ? 'Aberta' : 'Fechada'}
                    </span>
                    <Switch checked={form.isOpen} onCheckedChange={v => setForm(f => ({ ...f, isOpen: v }))} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Delivery</p>
                    <p className="text-xs text-slate-500 mt-1">Quando desligado, a opção de entrega some do cardápio digital — o cliente só consegue fazer Retirada no Balcão. Mesa e Balcão continuam funcionando normalmente.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-semibold ${form.isDeliveryOpen ? 'text-emerald-600' : 'text-red-500'}`}>
                      {form.isDeliveryOpen ? 'Ativo' : 'Pausado'}
                    </span>
                    <Switch checked={form.isDeliveryOpen} onCheckedChange={v => setForm(f => ({ ...f, isDeliveryOpen: v }))} />
                  </div>
                </div>
                <div className="py-5 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Senha do Balcão</p>
                    <p className="text-xs text-slate-500 mt-1">Como identificar um pedido de Balcão sem mesa. Nem todo estabelecimento chama por número — algumas lojas preferem identificar só pelo nome do cliente.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {([
                      { value: "TICKET", label: "Senha sequencial", desc: "Cada pedido de balcão recebe um número (Senha 01, 02...) — ideal quando o cliente aguarda ser chamado.", icon: Ticket },
                      { value: "NAME",   label: "Nome do cliente",  desc: "Sem número de senha — identifica pelo nome (se não digitar nada, o pedido fica só com o ID curto).", icon: User },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, counterTicketMode: opt.value }))}
                        className={`text-left p-3 rounded-xl border transition-all ${form.counterTicketMode === opt.value ? "border-[#0D1B3E] bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                      >
                        <opt.icon className={`w-4 h-4 mb-2 ${form.counterTicketMode === opt.value ? "text-[#0D1B3E]" : "text-slate-400"}`} strokeWidth={2} />
                        <p className={`text-xs font-semibold ${form.counterTicketMode === opt.value ? "text-[#0D1B3E]" : "text-slate-700"}`}>{opt.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Avisar Garçom quando a Comanda Ficar Pronta</p>
                    <p className="text-xs text-slate-500 mt-1">Notifica o garçom, em qualquer tela do sistema, quando a cozinha marcar a comanda da mesa como pronta para servir.</p>
                  </div>
                  <Switch checked={form.waiterNotifyOnReady} onCheckedChange={v => setForm(f => ({ ...f, waiterNotifyOnReady: v }))} />
                </div>
                <div className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Exigir Abertura/Fechamento de Caixa no PDV</p>
                    <p className="text-xs text-slate-500 mt-1">Se desligado, o PDV vende sem precisar abrir caixa (sem fundo, sangria/suprimento ou fechamento) — venda liberada direto.</p>
                  </div>
                  <Switch checked={form.requireCashRegister} onCheckedChange={v => setForm(f => ({ ...f, requireCashRegister: v }))} />
                </div>
                <div className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Largura da Impressora Térmica</p>
                    <p className="text-xs text-slate-500 mt-1">Define o formato do recibo gerado no PDV (imprimir ou baixar em PDF) para caber certinho na bobina da sua impressora.</p>
                  </div>
                  <FilterLineSegmented
                    value={String(form.receiptPaperWidth)}
                    onChange={v => setForm(f => ({ ...f, receiptPaperWidth: (Number(v) === 58 ? 58 : 80) as 58 | 80 }))}
                    options={[
                      { value: "80", label: "80mm" },
                      { value: "58", label: "58mm" },
                    ]}
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Imprimir Automaticamente ao Criar Pedido</p>
                    <p className="text-xs text-slate-500 mt-1">Assim que um pedido é criado (PDV, comanda/mesa via QR Code, delivery), imprime sozinho na impressora térmica configurada no app desktop — sem precisar clicar em "Imprimir".</p>
                  </div>
                  <Switch checked={printing.autoPrintOnOrderCreate} onCheckedChange={v => setPrinting(p => ({ ...p, autoPrintOnOrderCreate: v }))} />
                </div>
                {printing.autoPrintOnOrderCreate && (
                  <div className="flex items-center justify-between gap-4 py-5">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">2ª Via para o Estabelecimento</p>
                      <p className="text-xs text-slate-500 mt-1">Em pedidos de PDV, comanda e mesa, imprime uma segunda via (marcada "VIA DO ESTABELECIMENTO") além da via do cliente. Pedidos de delivery imprimem só 1 via.</p>
                    </div>
                    <Switch checked={printing.autoPrintEstablishmentCopy} onCheckedChange={v => setPrinting(p => ({ ...p, autoPrintEstablishmentCopy: v }))} />
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 py-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Imprimir Resumo ao Fechar Caixa</p>
                    <p className="text-xs text-slate-500 mt-1">Ao fechar o caixa, imprime automaticamente o resumo consolidado do turno (totais por forma de pagamento, quantidade de pedidos, sangrias/suprimentos) para conferência.</p>
                  </div>
                  <Switch checked={printing.autoPrintCashClosingReport} onCheckedChange={v => setPrinting(p => ({ ...p, autoPrintCashClosingReport: v }))} />
                </div>
                <div className="py-5">
                  <DesktopPrinterSettings />
                </div>
                {/* ── Modo de Operação (Delivery / Encomenda / Misto) ── */}
                <div className="pt-5">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-slate-800">Modo de Operação</p>
                    <p className="text-xs text-slate-500 mt-0.5">Define como os clientes podem fazer pedidos no cardápio digital.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                    {([
                      { value: "DELIVERY_ONLY",  label: "Só Delivery",          desc: "Entregas imediatas — cliente recebe no mesmo dia", icon: Truck },
                      { value: "PREORDER_ONLY",  label: "Só Encomenda",         desc: "Você define os dias de entrega (ex: só sábados). Cliente pede e você entrega na próxima data disponível", icon: PackageCheck },
                      { value: "BOTH",           label: "Delivery + Encomenda", desc: "Aceita tanto entregas imediatas quanto encomendas com data definida por você", icon: Sparkles },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          orderMode: opt.value,
                          scheduleMode: opt.value !== "DELIVERY_ONLY",
                        }))}
                        className={`text-left p-3 rounded-xl border transition-all ${form.orderMode === opt.value ? "border-[#0D1B3E] bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                      >
                        <opt.icon className={`w-4 h-4 mb-1.5 ${form.orderMode === opt.value ? "text-[#0D1B3E]" : "text-slate-400"}`} strokeWidth={2} />
                        <p className={`text-xs font-semibold ${form.orderMode === opt.value ? "text-[#0D1B3E]" : "text-slate-700"}`}>{opt.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>

                  {form.orderMode !== "DELIVERY_ONLY" && (
                    <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      {/* Tipo de agendamento */}
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-2">Quando o estabelecimento entrega?</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {([
                            { value: "CLIENT_CHOOSES", label: "Cliente informa a data", desc: "O cliente digita a data desejada — você decide se aceita ou não" },
                            { value: "OWNER_DEFINES",  label: "Você define os dias (recomendado)", desc: "Configure os dias e horários fixos de entrega. O cliente vê apenas as datas disponíveis" },
                          ] as const).map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, scheduleType: opt.value }))}
                              className={`text-left p-3 rounded-xl border transition-all ${form.scheduleType === opt.value ? "border-[#0D1B3E] bg-white" : "border-slate-200 bg-white/60 hover:border-slate-300"}`}
                            >
                              <p className={`text-xs font-semibold ${form.scheduleType === opt.value ? "text-[#0D1B3E]" : "text-slate-600"}`}>{opt.label}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dias e horários (só para OWNER_DEFINES) */}
                      {form.scheduleType === "OWNER_DEFINES" && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-2">Dias e turnos de entrega</p>
                          <div className="space-y-2">
                            {scheduleDays.map((day: any, idx: number) => (
                              <div key={day.weekday} className={`rounded-xl border p-3 transition-all ${day.enabled ? "bg-white border-slate-200" : "bg-slate-50/60 border-slate-100"}`}>
                                <div className="flex items-center gap-3 mb-2">
                                  <Switch
                                    checked={day.enabled}
                                    onCheckedChange={v => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, enabled: v } : d))}
                                  />
                                  <span className={`text-xs font-semibold w-16 shrink-0 ${day.enabled ? "text-slate-800" : "text-slate-400"}`}>{day.label}</span>
                                  {day.enabled && (
                                    <div className="flex flex-wrap gap-1.5 flex-1">
                                      {day.times.map((t: string, ti: number) => (
                                        <div key={ti} className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5">
                                          <TimeInput
                                            value={t}
                                            onChange={v => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, times: d.times.map((tt: string, tii: number) => tii === ti ? v : tt) } : d))}
                                          />
                                          {day.times.length > 1 && (
                                            <button type="button" onClick={() => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, times: d.times.filter((_: string, tii: number) => tii !== ti) } : d))} className="text-slate-400 hover:text-red-500 transition-colors">
                                              <X className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, times: [...d.times, "12:00"] } : d))}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 transition-colors text-[11px] font-medium"
                                      >
                                        <Plus className="w-3 h-3" /> horário
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Aviso para o cliente */}
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-1.5">Mensagem para o cliente (opcional)</p>
                        <textarea
                          value={form.scheduleNotes}
                          onChange={e => setForm(f => ({ ...f, scheduleNotes: e.target.value }))}
                          placeholder="Ex: Encomendas entregues toda semana aos sábados a partir das 10h. Pedido mínimo 48h antes."
                          rows={2}
                          className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0D1B3E]/10 focus:border-[#0D1B3E] resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ContentCard>

            <ContentCard padding="lg">
              <div className="flex items-center gap-3 mb-1">
                <Monitor className="w-4 h-4 text-slate-400" />
                <p className="text-xs font-semibold text-slate-600">Painel de Pedidos (TV)</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tipos de pedido exibidos, tema, cores, sons, voz, carrossel de propaganda e pareamento de TVs agora
                ficam em uma página própria: menu lateral → <strong className="text-slate-500">Config. Painel TV</strong>.
              </p>
            </ContentCard>

            {tenant?.id && <KitchenPasswordCard tenantId={tenant.id} />}
            {tenant?.id && <KitchenAccessRequestsCard tenantId={tenant.id} onApproved={() => {}} />}
            {tenant?.id && <KitchenStaffCard tenantId={tenant.id} />}

          </motion.div>
        )}

        {activeTab === "hours" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <ContentCard padding="lg">
              <SectionTitle title="Horários de Funcionamento" icon={Clock3} divider className="mb-5" />
              <div className="space-y-2">
                {DAY_KEYS_UI.map(day => {
                  const d = hours[day] ?? { enabled: false, open: "08:00", close: "22:00", breakEnabled: false, breakStart: "12:00", breakEnd: "13:00" };
                  return (
                    <div key={day} className={`rounded-xl border transition-all duration-200 ${d.enabled ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100"}`}>
                      {/* Row principal */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Switch checked={d.enabled} onCheckedChange={v => setDay(day, "enabled", v)} />
                        <span className={`text-xs font-semibold w-[72px] shrink-0 ${d.enabled ? "text-slate-800" : "text-slate-400"}`}>
                          {DAY_LABELS[day]}
                        </span>
                        {d.enabled ? (
                          <>
                            <div className="flex items-end gap-2 flex-1">
                              <TimeInput label="Abertura" value={d.open} onChange={v => setDay(day, "open", v)} />
                              <span className="text-slate-300 font-semibold text-sm pb-2 select-none">–</span>
                              <TimeInput label="Fechamento" value={d.close} onChange={v => setDay(day, "close", v)} />
                            </div>
                            <button
                              type="button"
                              onClick={() => setDay(day, "breakEnabled", !d.breakEnabled)}
                              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-semibold transition-all ${
                                d.breakEnabled
                                  ? "bg-slate-50 border-slate-300 text-slate-600"
                                  : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                              }`}
                            >
                              {d.breakEnabled ? <Clock className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              <span className="hidden sm:inline">{d.breakEnabled ? "Pausa" : "Intervalo"}</span>
                            </button>
                          </>
                        ) : (
                          <span className="ml-auto text-xs font-medium text-slate-300">Fechado</span>
                        )}
                      </div>
                      {/* Pausa */}
                      {d.enabled && d.breakEnabled && (
                        <div className="flex items-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                          <div className="w-[111px] shrink-0 pb-2">
                            <span className="text-[11px] font-semibold text-slate-400">Intervalo</span>
                          </div>
                          <TimeInput label="Início" value={d.breakStart ?? "12:00"} onChange={v => setDay(day, "breakStart", v)} />
                          <span className="text-slate-300 font-semibold text-sm pb-2 select-none">–</span>
                          <TimeInput label="Fim" value={d.breakEnd ?? "13:00"} onChange={v => setDay(day, "breakEnd", v)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ContentCard>
          </motion.div>
        )}

        {activeTab === "delivery" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContentCard padding="lg">
              <SectionTitle title="Regras de Entrega" icon={Truck} divider className="mb-6" />
              <div className="space-y-8">
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: "free", label: "Grátis", icon: CheckCircle2 },
                    { id: "fixed", label: "Taxa Fixa", icon: CircleDollarSign },
                    { id: "zones", label: "Por Bairro/CEP", icon: Truck },
                    { id: "km", label: "Por Distância (KM)", icon: Ruler },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDelivery(d => ({ ...d, mode: opt.id }))}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${delivery.mode === opt.id ? "bg-[#0D1B3E] text-white border-[#0D1B3E]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>

                {delivery.mode === "fixed" && (
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                      <CircleDollarSign className="w-5 h-5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-xs font-semibold text-slate-500">Valor Único de Entrega</label>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-semibold text-slate-400">R$</span>
                        <input
                          type="number" min="0" step="0.50"
                          value={delivery.fixedFee ?? ""}
                          onChange={e => setDelivery(d => ({ ...d, fixedFee: parseFloat(e.target.value) || 0 }))}
                          className="w-32 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-base font-bold text-slate-800 focus:border-[#0D1B3E] outline-none transition-all shadow-sm"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {delivery.mode === "zones" && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-slate-800">Cobrança fallback</p>
                        <p className="text-xs text-slate-400">Para locais não cadastrados</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400">R$</span>
                        <input
                          type="number" min="0" step="0.50"
                          value={delivery.defaultFee ?? ""}
                          onChange={e => setDelivery(d => ({ ...d, defaultFee: parseFloat(e.target.value) || 0 }))}
                          className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:border-[#0D1B3E] outline-none"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-500">Zonas de Entrega</p>
                        <span className="text-xs text-slate-400 font-medium">{delivery.zones?.length || 0} zonas</span>
                      </div>
                      {delivery.zones?.map((zone, idx) => (
                        <div key={zone.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-300 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100 transition-all">
                              <Truck className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{zone.label}</p>
                              <p className="text-xs text-slate-400">CEP: {zone.ceps.join(", ")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-[#0D1B3E]">{zone.fee === 0 ? "Grátis" : fmt(zone.fee)}</span>
                            <button
                              type="button"
                              onClick={() => setDelivery(d => ({ ...d, zones: d.zones?.filter((_, i) => i !== idx) }))}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <ZoneAdder onAdd={z => setDelivery(d => ({ ...d, zones: [...(d.zones || []), z] }))} />
                    </div>
                  </div>
                )}

                {delivery.mode === "km" && (
                  <div className="space-y-6">
                    {/* Origin CEP */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <p className="text-xs font-semibold text-slate-600">CEP de Origem (seu estabelecimento)</p>
                      </div>
                      <p className="text-xs text-slate-400">O cálculo de distância parte deste CEP até o CEP do cliente.</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={9}
                        value={delivery.originCep
                          ? delivery.originCep.replace(/^(\d{5})(\d{1,3})$/, "$1-$2")
                          : ""}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                          setDelivery(d => ({ ...d, originCep: digits }));
                        }}
                        placeholder="00000-000"
                        className="w-40 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:border-[#0D1B3E] outline-none transition-all shadow-sm"
                      />
                    </div>

                    {/* KM ranges */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-500">Faixas de Distância</p>
                        <span className="text-xs text-slate-400 font-medium">{delivery.kmRanges?.length || 0} faixas</span>
                      </div>

                      {[...(delivery.kmRanges || [])].sort((a, b) => a.upToKm - b.upToKm).map((range, idx, arr) => {
                        const from = idx === 0 ? 0 : arr[idx - 1].upToKm;
                        return (
                          <div key={range.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-300 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-100 transition-all">
                                <Ruler className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {from === 0 ? `Até ${range.upToKm} km` : `De ${from} km até ${range.upToKm} km`}
                                </p>
                                <p className="text-xs text-slate-400">Faixa {idx + 1}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-[#0D1B3E]">{range.fee === 0 ? "Grátis" : fmt(range.fee)}</span>
                              <button
                                type="button"
                                onClick={() => setDelivery(d => ({ ...d, kmRanges: d.kmRanges?.filter(r => r.id !== range.id) }))}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <KmRangeAdder onAdd={r => setDelivery(d => ({ ...d, kmRanges: [...(d.kmRanges || []), r] }))} />
                    </div>

                    {/* Beyond last range */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                      <p className="text-xs font-semibold text-slate-500">Além da última faixa</p>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <Switch
                          checked={delivery.kmAllowBeyond ?? true}
                          onCheckedChange={v => setDelivery(d => ({ ...d, kmAllowBeyond: v }))}
                        />
                        <span className="text-sm font-medium text-slate-700">Aceitar pedidos além da última faixa</span>
                      </label>
                      {(delivery.kmAllowBeyond ?? true) && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-slate-400">Taxa R$</span>
                          <input
                            type="number" min="0" step="0.50"
                            value={delivery.kmDefaultFee ?? ""}
                            onChange={e => setDelivery(d => ({ ...d, kmDefaultFee: parseFloat(e.target.value) || 0 }))}
                            className="w-28 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:border-[#0D1B3E] outline-none"
                            placeholder="0,00"
                          />
                          <span className="text-xs text-slate-400">(0 = grátis)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ContentCard>
          </motion.div>
        )}

        {activeTab === "payments" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContentCard padding="lg">
              <SectionTitle title="Meios de Pagamento Disponíveis" icon={Wallet} divider className="mb-6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "pix", label: "PIX Dinâmico", icon: QrCode, desc: "Aprovação instantânea" },
                  { id: "credit", label: "Cartão de Crédito", icon: CreditCard, desc: "Visa, Master, Elo..." },
                  { id: "debit", label: "Cartão de Débito", icon: CreditCard, desc: "Pagamento à vista" },
                  { id: "meal", label: "Vale Refeição (VR)", icon: Utensils, desc: "Sodexo, Alelo, VR" },
                  { id: "food", label: "Vale Alimentação (VA)", icon: Package, desc: "Ticket, Alelo" },
                ].map((method) => {
                  const methodConfig = payments[method.id as keyof PaymentConfig] as PaymentMethodConfig;
                  const isEnabled = methodConfig?.enabled;
                  const acceptedBrands = methodConfig?.acceptedBrands || [];
                  const allBrands = [...CARD_BRANDS_LIST.map(b => b.label), ...(payments.customBrands || [])];

                  return (
                    <div
                      key={method.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isEnabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isEnabled ? 'bg-[#0D1B3E]/5 text-[#0D1B3E]' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <method.icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{method.label}</p>
                            <p className="text-xs text-slate-400 truncate">{method.desc}</p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={v => setPayments({
                            ...payments,
                            [method.id]: { ...(methodConfig || { label: method.label }), enabled: v }
                          })}
                        />
                      </div>

                      {isEnabled && (
                        <div className="pt-3 border-t border-slate-100 space-y-3">
                          <p className="text-xs font-semibold text-slate-500">Bandeiras Aceitas</p>
                          <div className="flex flex-wrap gap-1.5">
                            {allBrands.map(brand => {
                              const isSelected = acceptedBrands.includes(brand);
                              return (
                                <button
                                  key={brand}
                                  type="button"
                                  onClick={() => {
                                    const next = isSelected
                                      ? acceptedBrands.filter(b => b !== brand)
                                      : [...acceptedBrands, brand];
                                    setPayments({
                                      ...payments,
                                      [method.id]: { ...methodConfig, acceptedBrands: next }
                                    });
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                    isSelected
                                      ? 'bg-[#0D1B3E] border-[#0D1B3E] text-white'
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                  }`}
                                >
                                  {brand}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Nova bandeira..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = e.currentTarget.value.trim();
                                  if (val) {
                                    const custom = payments.customBrands || [];
                                    if (!custom.includes(val)) {
                                      setPayments({
                                        ...payments,
                                        customBrands: [...custom, val],
                                        [method.id]: { ...methodConfig, acceptedBrands: [...acceptedBrands, val] }
                                      });
                                    } else if (!acceptedBrands.includes(val)) {
                                      setPayments({
                                        ...payments,
                                        [method.id]: { ...methodConfig, acceptedBrands: [...acceptedBrands, val] }
                                      });
                                    }
                                    e.currentTarget.value = "";
                                  }
                                }
                              }}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-[#0D1B3E] transition-all"
                            />
                            <div className="p-2 text-slate-300">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div
                  key="cash"
                  className={`p-5 rounded-2xl border transition-all sm:col-span-2 ${
                    payments.cash?.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        payments.cash?.enabled ? 'bg-[#0D1B3E]/5 text-[#0D1B3E]' : 'bg-slate-200 text-slate-400'
                      }`}>
                        <Banknote className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Dinheiro no Local</p>
                        <p className="text-xs text-slate-400">Pagamento na entrega ou balcão</p>
                      </div>
                    </div>
                    <Switch
                      checked={payments.cash?.enabled}
                      onCheckedChange={v => setPayments({
                        ...payments,
                        cash: { ...(payments.cash || { label: "Dinheiro", allowChange: true }), enabled: v }
                      })}
                    />
                  </div>
                  {payments.cash?.enabled && (
                    <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl cursor-pointer transition-all hover:bg-slate-100">
                      <input 
                        type="checkbox" 
                        checked={payments.cash?.allowChange !== false}
                        onChange={e => setPayments({
                          ...payments,
                          cash: { ...payments.cash!, allowChange: e.target.checked }
                        })}
                        className="w-4 h-4 rounded accent-[#C9A227]"
                      />
                      <span className="text-xs font-medium text-slate-600">Perguntar sobre troco no checkout</span>
                    </label>
                  )}
                </div>
              </div>
            </ContentCard>
          </motion.div>
        )}

        {activeTab === "maquinhas" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Stone / Pagar.me */}
            <ContentCard padding="lg">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${stone.enabled ? "bg-[#00A859]/10 text-[#00A859]" : "bg-slate-100 text-slate-400"}`}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Stone / Pagar.me</p>
                  <p className="text-xs text-slate-400">Maquininha física via API Pagar.me</p>
                </div>
                <Switch checked={stone.enabled} onCheckedChange={v => setStone({ ...stone, enabled: v })} />
              </div>

              {stone.enabled && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-700 leading-relaxed">
                      <p className="font-semibold mb-1">Como configurar:</p>
                      <ol className="list-decimal ml-3 space-y-1">
                        <li>Acesse o <strong>Partner Hub da Stone</strong> ou painel do Pagar.me.</li>
                        <li>Copie sua <strong>Secret Key</strong> (sk_live_... ou sk_test_...).</li>
                        <li>O <strong>Stonecode</strong> é o código do estabelecimento que vincula ao terminal físico.</li>
                        <li>Salve as configurações — a maquininha aparecerá como opção no PDV.</li>
                      </ol>
                    </div>
                  </div>

                  <Input
                    label="Secret Key (Pagar.me)"
                    value={stone.secretKey}
                    onChange={e => setStone({ ...stone, secretKey: e.target.value })}
                    placeholder="sk_live_xxxxxxxxxxxx"
                    type="password"
                  />
                  <Input
                    label="Stonecode (código do estabelecimento)"
                    value={stone.stonecode}
                    onChange={e => setStone({ ...stone, stonecode: e.target.value })}
                    placeholder="Ex: 123456789"
                  />

                  <div className="bg-slate-50 rounded-2xl p-4 flex items-start gap-3 border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-[#00A859]/10 text-[#00A859] flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">Fluxo de pagamento</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        No PDV, selecione "Maquininha" e o tipo (crédito, débito ou PIX). O sistema envia a cobrança automaticamente para o terminal físico. O cliente paga e o sistema confirma.
                      </p>
                    </div>
                  </div>

                  {stone.secretKey && (
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Credenciais configuradas — salve para ativar.
                    </div>
                  )}
                </div>
              )}

              {!stone.enabled && (
                <div className="text-center py-8 text-slate-400">
                  <Smartphone className="w-8 h-8 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
                  <p className="text-xs font-semibold mb-1">Maquininha desativada</p>
                  <p className="text-xs">Ative acima para configurar a integração com a Stone.</p>
                </div>
              )}
            </ContentCard>

            {/* Taxas da Maquininha */}
            <ContentCard padding="lg">
              <SectionTitle title="Taxas da Maquininha" icon={CircleDollarSign} className="mb-1" />
              <p className="text-xs text-slate-400 mb-6 mt-2">Configure o percentual cobrado pela adquirente por bandeira/provedor. Esses valores alimentam o custo exibido no financeiro e, se ativado, o acréscimo cobrado do cliente no PDV.</p>

              {/* PIX — taxa única do provedor, sem bandeira/parcela */}
              {payments.pix?.enabled && (
                <div className="mb-6 pb-6 border-b border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <p className="text-sm font-semibold text-slate-800">Pix</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs font-medium text-slate-400">Repassar taxa ao cliente</span>
                      <Switch
                        checked={!!payments.pix.passFeeToCustomer}
                        onCheckedChange={(v) => setPayments({ ...payments, pix: { ...payments.pix!, passFeeToCustomer: v } })}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3 max-w-xs">
                    <span className="text-xs font-medium text-slate-400 flex-1">Taxa do provedor</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={payments.pix.brandFees?.["PIX"]?.installmentFees?.["1"] ?? ""}
                        onChange={(e) => {
                          const pct = parseFloat(e.target.value.replace(",", ".")) || 0;
                          setPayments({
                            ...payments,
                            pix: { ...payments.pix!, brandFees: { PIX: { installmentFees: { "1": pct } } } },
                          });
                        }}
                        placeholder="0,0"
                        className="w-16 text-center bg-white border border-slate-200 rounded-lg py-1.5 text-xs font-semibold outline-none focus:border-[#0D1B3E] transition-all"
                      />
                      <span className="text-xs font-semibold text-slate-400">%</span>
                    </div>
                  </div>
                </div>
              )}

              {(["credit", "debit"] as const).map((methodKey) => {
                const methodConfig = payments[methodKey] as PaymentMethodConfig | undefined;
                if (!methodConfig?.enabled) return null;
                const brands = methodConfig.acceptedBrands?.length ? methodConfig.acceptedBrands : [];
                const installmentsRange = methodKey === "credit" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1];
                const brandFees = methodConfig.brandFees || {};

                const updateFee = (brand: string, installment: number, value: string) => {
                  const pct = parseFloat(value.replace(",", ".")) || 0;
                  const current = brandFees[brand]?.installmentFees || {};
                  setPayments({
                    ...payments,
                    [methodKey]: {
                      ...methodConfig,
                      brandFees: {
                        ...brandFees,
                        [brand]: { installmentFees: { ...current, [String(installment)]: pct } },
                      },
                    },
                  });
                };

                const addBrand = (name: string) => {
                  const trimmed = name.trim();
                  if (!trimmed || brands.includes(trimmed)) return;
                  setPayments({
                    ...payments,
                    [methodKey]: { ...methodConfig, acceptedBrands: [...brands, trimmed] },
                  });
                };

                const removeBrand = (name: string) => {
                  const { [name]: _removed, ...restFees } = brandFees;
                  setPayments({
                    ...payments,
                    [methodKey]: {
                      ...methodConfig,
                      acceptedBrands: brands.filter((b) => b !== name),
                      brandFees: restFees,
                    },
                  });
                };

                return (
                  <div key={methodKey} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-0 border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {methodKey === "credit" ? "Cartão de Crédito" : "Cartão de Débito"}
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xs font-medium text-slate-400">Repassar taxa ao cliente</span>
                        <Switch
                          checked={!!methodConfig.passFeeToCustomer}
                          onCheckedChange={(v) => setPayments({
                            ...payments,
                            [methodKey]: { ...methodConfig, passFeeToCustomer: v },
                          })}
                        />
                      </label>
                    </div>

                    {/* Cards por bandeira — responsivo, uma bandeira por bloco */}
                    <div className="space-y-3">
                      {brands.map((brand) => (
                        <div key={brand} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-slate-700">{brand}</p>
                            <button
                              type="button"
                              onClick={() => removeBrand(brand)}
                              className="text-slate-300 hover:text-red-400 transition-colors"
                              title="Remover bandeira"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {installmentsRange.map((n) => (
                              <div key={n} className="flex flex-col gap-1">
                                <span className="text-[11px] font-medium text-slate-400 text-center">
                                  {methodKey === "credit" ? `${n}x` : "à vista"}
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={brandFees[brand]?.installmentFees?.[String(n)] ?? ""}
                                    onChange={(e) => updateFee(brand, n, e.target.value)}
                                    placeholder="0,0"
                                    className="w-full min-w-0 text-center bg-white border border-slate-200 rounded-lg py-1.5 text-xs font-semibold outline-none focus:border-[#0D1B3E] transition-all"
                                  />
                                  <span className="text-xs font-semibold text-slate-400 shrink-0">%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Adicionar nova bandeira */}
                    <div className="flex gap-2 mt-3">
                      <input
                        type="text"
                        placeholder="Adicionar bandeira (ex: Cabal, Banricompras...)"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addBrand(e.currentTarget.value);
                            e.currentTarget.value = "";
                          }
                        }}
                        className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-[#0D1B3E] transition-all"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = (e.currentTarget.previousSibling as HTMLInputElement);
                          addBrand(input.value);
                          input.value = "";
                        }}
                        className="shrink-0 px-3 py-2 bg-[#0D1B3E] text-white rounded-xl hover:bg-[#0D1B3E]/90 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {brands.length === 0 && (
                      <p className="text-xs text-slate-400 mt-2">Nenhuma bandeira cadastrada ainda — adicione acima ou na aba "Pagamentos".</p>
                    )}
                  </div>
                );
              })}

              {!payments.pix?.enabled && !payments.credit?.enabled && !payments.debit?.enabled && (
                <div className="text-center py-8 text-slate-400">
                  <CreditCard className="w-8 h-8 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
                  <p className="text-xs font-semibold mb-1">Nenhum meio de pagamento habilitado</p>
                  <p className="text-xs">Ative Pix, Crédito ou Débito na aba "Pagamentos" para configurar as taxas.</p>
                </div>
              )}
            </ContentCard>

            {/* Taxa de Serviço */}
            <ContentCard padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                <SectionTitle title="Taxa de Serviço" icon={CircleDollarSign} />
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-medium text-slate-400">Ativar</span>
                  <Switch
                    checked={!!payments.serviceCharge?.enabled}
                    onCheckedChange={(v) => setPayments({
                      ...payments,
                      serviceCharge: { enabled: v, percent: payments.serviceCharge?.percent ?? 10 },
                    })}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400 mb-6 mt-2">
                Percentual sobre o subtotal dos itens (ex: 10% em mesas). Quando ativada, vem pré-marcada no pagamento do PDV,
                mas o operador sempre pode desmarcar ou ajustar caso o cliente não queira pagar.
              </p>

              {payments.serviceCharge?.enabled && (
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3 max-w-xs">
                  <span className="text-xs font-medium text-slate-400 flex-1">Percentual</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={payments.serviceCharge?.percent ?? ""}
                      onChange={(e) => {
                        const pct = parseFloat(e.target.value.replace(",", ".")) || 0;
                        setPayments({
                          ...payments,
                          serviceCharge: { enabled: true, percent: pct },
                        });
                      }}
                      placeholder="10"
                      className="w-16 text-center bg-white border border-slate-200 rounded-lg py-1.5 text-xs font-semibold outline-none focus:border-[#0D1B3E] transition-all"
                    />
                    <span className="text-xs font-semibold text-slate-400">%</span>
                  </div>
                </div>
              )}
            </ContentCard>

            {/* Futuras integrações */}
            <ContentCard padding="lg">
              <p className="text-xs font-semibold text-slate-500 mb-4">Outras Maquininhas (em breve)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 opacity-50 pointer-events-none select-none">
                {["Cielo", "Rede", "GetNet", "PagSeguro", "Mercado Pago"].map(name => (
                  <div key={name} className="p-4 rounded-2xl border border-slate-100 text-center">
                    <CreditCard className="w-5 h-5 mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
                    <p className="text-xs font-medium text-slate-400">{name}</p>
                  </div>
                ))}
              </div>
            </ContentCard>
          </motion.div>
        )}

        {/* ── ABA FISCAL ─────────────────────────────────────────────────── */}
        {activeTab === "fiscal" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContentCard padding="lg">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${fiscal.enabled ? "bg-[#0D1B3E]/5 text-[#0D1B3E]" : "bg-slate-100 text-slate-400"}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">Módulo Fiscal — NFC-e</p>
                  <p className="text-xs text-slate-400">Nota Fiscal do Consumidor Eletrônica (Modelo 65)</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Switch checked={fiscal.enabled} onCheckedChange={v => setFiscal(f => ({ ...f, enabled: v }))} />
                  <span className="text-xs font-medium text-slate-600">{fiscal.enabled ? "Ativo" : "Inativo"}</span>
                </label>
              </div>

              {fiscal.enabled && (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  {/* Ambiente */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-3">Ambiente SEFAZ</p>
                    <div className="flex gap-3">
                      {(["homologacao", "producao"] as const).map(env => (
                        <button key={env} type="button"
                          onClick={() => setFiscal(f => ({ ...f, ambiente: env }))}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all ${fiscal.ambiente === env ? "bg-[#0D1B3E] text-white border-[#0D1B3E]" : "bg-white text-slate-400 border-slate-200"}`}
                        >
                          {env === "homologacao" ? <FlaskConical className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />}
                          {env === "homologacao" ? "Homologação (teste)" : "Produção"}
                        </button>
                      ))}
                    </div>
                    {fiscal.ambiente === "homologacao" && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                        Em homologação as notas <strong>não têm valor fiscal</strong>. Use para testar a integração com a SEFAZ antes de ir para produção.
                      </div>
                    )}
                  </div>

                  {/* Dados do Emitente */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-3">Dados do Emitente</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">CNPJ</label>
                        <input type="text" maxLength={18} value={fiscal.cnpj}
                          onChange={e => setFiscal(f => ({ ...f, cnpj: e.target.value }))}
                          placeholder="00.000.000/0000-00"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Inscrição Estadual (IE)</label>
                        <input type="text" value={fiscal.ie}
                          onChange={e => setFiscal(f => ({ ...f, ie: e.target.value }))}
                          placeholder="000.000.000.000"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Regime Tributário (CRT)</label>
                        <select value={fiscal.crt} onChange={e => setFiscal(f => ({ ...f, crt: e.target.value as any }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        >
                          <option value="1">1 — Simples Nacional</option>
                          <option value="2">2 — Simples Nacional (excesso sublimite)</option>
                          <option value="3">3 — Regime Normal</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">UF</label>
                        <select value={fiscal.uf} onChange={e => setFiscal(f => ({ ...f, uf: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        >
                          {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Código IBGE do Município</label>
                        <input type="text" value={fiscal.cMun}
                          onChange={e => setFiscal(f => ({ ...f, cMun: e.target.value }))}
                          placeholder="Ex: 3550308 (São Paulo)"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Nome do Município</label>
                        <input type="text" value={fiscal.xMun}
                          onChange={e => setFiscal(f => ({ ...f, xMun: e.target.value }))}
                          placeholder="Ex: São Paulo"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* NFC-e — Série e número */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-3">Numeração NFC-e</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Série</label>
                        <input type="number" min={1} max={999} value={fiscal.serie}
                          onChange={e => setFiscal(f => ({ ...f, serie: parseInt(e.target.value) || 1 }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Próximo Número</label>
                        <input type="number" min={1} value={fiscal.proximoNumero}
                          onChange={e => setFiscal(f => ({ ...f, proximoNumero: parseInt(e.target.value) || 1 }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CSC */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-3">CSC — Código de Segurança do Contribuinte</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 mb-3 leading-relaxed">
                      O CSC é cadastrado no portal da SEFAZ do seu estado. Em SP: <span className="font-semibold text-slate-700">NF-e / Minha Conta</span>. Você receberá o Token e o ID do token.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">ID do CSC</label>
                        <input type="text" value={fiscal.cscId}
                          onChange={e => setFiscal(f => ({ ...f, cscId: e.target.value }))}
                          placeholder="Ex: 1"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Token CSC</label>
                        <input type="password" value={fiscal.csc}
                          onChange={e => setFiscal(f => ({ ...f, csc: e.target.value }))}
                          placeholder="Token UUID da SEFAZ"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Certificado A1 */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-3">Certificado Digital A1 (.pfx)</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      {fiscal.certBase64 ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-700">Certificado carregado</p>
                            <p className="text-xs text-slate-400">Clique em "Trocar" para substituir</p>
                          </div>
                          <button type="button" onClick={() => setFiscal(f => ({ ...f, certBase64: undefined, certPassword: undefined }))}
                            className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-slate-200 text-slate-400 flex items-center justify-center transition-all">
                            <FileDown className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-700">Selecionar arquivo .pfx</p>
                            <p className="text-xs text-slate-400">Certificado A1 emitido pela AC</p>
                          </div>
                          <input type="file" accept=".pfx,.p12" className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => {
                                const b64 = (ev.target?.result as string).split(",")[1];
                                setFiscal(f => ({ ...f, certBase64: b64 }));
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      )}
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Senha do Certificado</label>
                        <input type="password" value={fiscal.certPassword ?? ""}
                          onChange={e => setFiscal(f => ({ ...f, certPassword: e.target.value }))}
                          placeholder="Senha do arquivo .pfx"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:border-[#0D1B3E] outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!fiscal.enabled && (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-3 opacity-40" strokeWidth={1.5} />
                  <p className="text-xs font-semibold mb-1">Módulo Fiscal Inativo</p>
                  <p className="text-xs">Ative acima para configurar a emissão de NFC-e.</p>
                </div>
              )}
            </ContentCard>
          </motion.div>
        )}

        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 p-2.5 sm:p-3 rounded-2xl shadow-xl flex items-center justify-between gap-3">
            <div className="hidden sm:flex items-center gap-2 pl-4">
              {saved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : saving ? (
                <Clock className="w-4 h-4 text-slate-400 animate-pulse" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              )}
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Status das Alterações</p>
                <p className="text-xs font-semibold text-slate-800">
                  {saved ? "Tudo salvo" : saving ? "Salvando..." : "Alterações pendentes"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => refresh()}
                className="flex-1 sm:flex-none"
              >
                Descartar
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                loading={saving}
                className="flex-1 sm:min-w-[200px]"
                iconLeft={<CheckCircle2 className="w-4 h-4" />}
              >
                {saved ? "Salvo com Sucesso" : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <CondominiumsCard tenant={tenant} />
    </PageWrapper>
  );
}
