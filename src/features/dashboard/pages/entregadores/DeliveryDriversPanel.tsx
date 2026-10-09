import { useCallback, useEffect, useState } from "react";
import {
  Bike,
  ClipboardList,
  Edit2,
  Phone,
  Plus,
  Trash2,
  TrendingUp,
  Truck,
} from "lucide-react";
import type { DeliveryDriver, Tenant } from "../../../../types";
import {
  Modal, ModalFooter, ConfirmModal, Button, IconButton, Input, Switch, SectionTitle, Alert, Badge, Tabs,
  PageWrapper, StatGrid, StatCard, FilterLine, FilterLineSection, FilterLineDateRange, GridTable, useToast,
} from "../../../../components";
import type { Column } from "../../../../components";
import { apiFetch, apiJson } from "../../../../lib/api";

interface Props {
  slug: string;
  tenant: Tenant;
}

interface DriverReportRow {
  driverId: string;
  name: string;
  active: boolean;
  deliveries: number;
  total: number;
}

const TABS = [
  { id: "list", label: "Cadastro", icon: Bike },
  { id: "report", label: "Relatório de Entregas", icon: ClipboardList },
] as const;

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function fmtPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function whatsappUrl(phone: string) {
  const d = phone.replace(/\D/g, "");
  const num = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${num}`;
}

// ─── Modal de cadastro/edição ───────────────────────────────────────────────

function DriverModal({ driver, slug, onClose, onSaved }: { driver: DeliveryDriver | null; slug: string; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!driver;
  const [name, setName] = useState(driver?.name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [vehicle, setVehicle] = useState(driver?.vehicle ?? "");
  const [plate, setPlate] = useState(driver?.plate ?? "");
  const [active, setActive] = useState(driver?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true); setError("");
    try {
      const url = isEdit ? `/api/tenants/${slug}/delivery-drivers/${driver!.id}` : `/api/tenants/${slug}/delivery-drivers`;
      await apiJson(url, {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify({ name: name.trim(), phone: phone || null, vehicle: vehicle || null, plate: plate || null, active }),
      });
      onSaved();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar entregador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? `Editar — ${driver!.name}` : "Novo Entregador"}
      size="sm"
      footer={
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>{isEdit ? "Salvar alterações" : "Cadastrar"}</Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 py-1">
        {error && (
          <Alert variant="error">{error}</Alert>
        )}
        <Input label="Nome *" value={name} onChange={(e) => setName(e.target.value)} placeholder="João da Silva" />
        <Input label="Telefone / WhatsApp" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="numeric" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Veículo" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Moto CG 160" />
          <Input label="Placa" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC1D23" />
        </div>
        <Switch checked={active} onCheckedChange={setActive} label="Ativo" />
      </form>
    </Modal>
  );
}

// ─── Painel principal ────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().split("T")[0]; }
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function DeliveryDriversPanel({ slug }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("list");
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);
  const [deleteDriver, setDeleteDriver] = useState<DeliveryDriver | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [dateFrom, setDateFrom] = useState<string | null>(firstOfMonthISO());
  const [dateTo, setDateTo] = useState<string | null>(todayISO());
  const [report, setReport] = useState<DriverReportRow[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/tenants/${slug}/delivery-drivers`);
      setDrivers(res.ok ? await res.json() : []);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await apiFetch(`/api/tenants/${slug}/delivery-drivers/report?${params}`);
      setReport(res.ok ? await res.json() : []);
    } finally {
      setReportLoading(false);
    }
  }, [slug, dateFrom, dateTo]);

  useEffect(() => { loadDrivers(); }, [loadDrivers]);
  useEffect(() => { if (tab === "report") loadReport(); }, [tab, loadReport]);

  async function handleDelete() {
    if (!deleteDriver) return;
    setDeleting(true);
    try {
      await apiJson(`/api/tenants/${slug}/delivery-drivers/${deleteDriver.id}`, { method: "DELETE" });
      toast.success("Entregador removido.");
      setDeleteDriver(null);
      loadDrivers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover entregador.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive(driver: DeliveryDriver) {
    try {
      await apiJson(`/api/tenants/${slug}/delivery-drivers/${driver.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !driver.active }),
      });
      loadDrivers();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar entregador.");
    }
  }

  const totalDeliveries = report?.reduce((s, r) => s + r.deliveries, 0) ?? 0;
  const totalValue = report?.reduce((s, r) => s + r.total, 0) ?? 0;

  const driverColumns: Column<DeliveryDriver>[] = [
    {
      header: "Entregador",
      render: (d) => (
        <div className={`flex min-w-0 items-center gap-3 ${d.active ? "" : "opacity-60"}`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <Bike className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[13px] font-medium text-slate-800">{d.name}</p>
              {!d.active && <Badge color="default" size="sm">Inativo</Badge>}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: "Contato / Veículo",
      render: (d) => (
        <span className="text-xs text-slate-500">
          {[d.phone && fmtPhone(d.phone), d.vehicle, d.plate].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      header: "Ações",
      className: "text-right",
      headerClassName: "text-right",
      render: (d) => (
        <div className="flex items-center justify-end gap-1">
          {d.phone && (
            <a
              href={whatsappUrl(d.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50"
              title="WhatsApp"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          <Switch checked={d.active} onCheckedChange={() => handleToggleActive(d)} aria-label={d.active ? "Desativar entregador" : "Ativar entregador"} />
          <IconButton aria-label="Editar entregador" variant="ghost" size="sm" onClick={() => { setEditingDriver(d); setShowModal(true); }}>
            <Edit2 size={14} />
          </IconButton>
          <IconButton aria-label="Remover entregador" variant="ghost" size="sm" onClick={() => setDeleteDriver(d)}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      ),
    },
  ];

  const reportColumns: Column<DriverReportRow>[] = [
    {
      header: "Entregador",
      render: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <Bike className="h-4 w-4 text-blue-600" />
          </div>
          <p className="truncate text-[13px] font-medium text-slate-800">{r.name}</p>
        </div>
      ),
    },
    {
      header: "Entregas",
      render: (r) => <span className="text-xs text-slate-500">{r.deliveries} entrega{r.deliveries !== 1 ? "s" : ""}</span>,
    },
    {
      header: "Valor",
      className: "text-right",
      headerClassName: "text-right",
      render: (r) => <span className="text-[13px] font-medium text-slate-800">{fmt(r.total)}</span>,
    },
  ];

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Entregadores"
          description="Cadastre os motoboys e acompanhe as entregas de cada um."
          icon={Bike}
          action={
            tab === "list" ? (
              <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => { setEditingDriver(null); setShowModal(true); }}>
                Novo Entregador
              </Button>
            ) : undefined
          }
        />

        <Tabs<(typeof TABS)[number]["id"]> items={TABS} value={tab} onChange={setTab} label="Entregadores">
          {tab === "list" && (
            <div className="space-y-3">
              <GridTable
                data={drivers}
                columns={driverColumns}
                keyExtractor={(d) => d.id}
                isLoading={loading}
                emptyMessage="Nenhum entregador cadastrado. Cadastre os motoboys pra poder atribuir quem entrega cada pedido."
              />
            </div>
          )}

          {tab === "report" && (
            <div className="space-y-3">
              <FilterLine>
                <FilterLineSection>
                  <FilterLineDateRange from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
                </FilterLineSection>
              </FilterLine>

              {report && (
                <StatGrid cols={2}>
                  <StatCard title="Entregas no período" value={totalDeliveries} icon={Truck} color="info" />
                  <StatCard title="Valor total entregue" value={totalValue} isCurrency icon={TrendingUp} color="success" />
                </StatGrid>
              )}

              <GridTable
                data={report ?? []}
                columns={reportColumns}
                keyExtractor={(r) => r.driverId}
                isLoading={reportLoading}
                emptyMessage="Nenhuma entrega no período. Sem entregas atribuídas a entregadores nesse período."
              />
            </div>
          )}
        </Tabs>
      </div>

      {showModal && (
        <DriverModal
          driver={editingDriver}
          slug={slug}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadDrivers(); }}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteDriver}
        onClose={() => setDeleteDriver(null)}
        onConfirm={handleDelete}
        title="Remover entregador"
        confirmLabel="Remover"
        loading={deleting}
        message={<>Tem certeza que quer remover <span className="font-medium text-slate-800">{deleteDriver?.name}</span>? Pedidos antigos continuam mostrando o nome dele no histórico.</>}
      />
    </PageWrapper>
  );
}
