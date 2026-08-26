import { useCallback, useEffect, useState } from "react";
import {
  Bike,
  Edit2,
  Filter,
  Package,
  Phone,
  Plus,
  Trash2,
  TrendingUp,
  Truck,
} from "lucide-react";
import type { DeliveryDriver, Tenant } from "../../../../types";
import { Modal, ModalFooter, Button, Input, Switch, SectionTitle, EmptyState, useToast } from "../../../../components";
import { DatePicker } from "../../../../components/DatePicker";
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
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}
        <Input label="Nome *" value={name} onChange={(e) => setName(e.target.value)} placeholder="João da Silva" />
        <Input label="Telefone / WhatsApp" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="numeric" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Veículo" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Moto CG 160" />
          <Input label="Placa" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC1D23" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-slate-600 font-medium">Ativo</span>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
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
  const [tab, setTab] = useState<"list" | "report">("list");
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

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Entregadores"
        description="Cadastre os motoboys e acompanhe as entregas de cada um."
        icon={Bike}
      />

      <div className="flex gap-2">
        <button
          onClick={() => setTab("list")}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tab === "list" ? "bg-[#0A1628] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"}`}
        >
          Cadastro
        </button>
        <button
          onClick={() => setTab("report")}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tab === "report" ? "bg-[#0A1628] text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"}`}
        >
          Relatório de Entregas
        </button>
      </div>

      {tab === "list" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditingDriver(null); setShowModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#C9A227] hover:bg-[#b8911f] text-white text-xs font-black transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Entregador
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-[#C9A227] rounded-full animate-spin" />
            </div>
          ) : drivers.length === 0 ? (
            <EmptyState
              icon={Bike}
              title="Nenhum entregador cadastrado"
              description="Cadastre os motoboys pra poder atribuir quem entrega cada pedido."
            />
          ) : (
            <div className="space-y-2">
              {drivers.map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-4 px-4 py-3 bg-white rounded-xl border ${d.active ? "border-slate-200" : "border-slate-100 opacity-60"}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Bike className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-slate-800">{d.name}</p>
                      {!d.active && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-zinc-100 text-slate-500">Inativo</span>
                      )}
                    </div>
                    {(d.phone || d.vehicle || d.plate) && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {[d.phone && fmtPhone(d.phone), d.vehicle, d.plate].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.phone && (
                      <a
                        href={whatsappUrl(d.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl text-green-600 hover:bg-green-50 transition-colors"
                        title="WhatsApp"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    <Switch checked={d.active} onCheckedChange={() => handleToggleActive(d)} />
                    <button onClick={() => { setEditingDriver(d); setShowModal(true); }} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteDriver(d)} className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "report" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-slate-400" />
              <p className="text-sm font-bold text-slate-700">Filtrar período</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePicker label="De" value={dateFrom} onChange={setDateFrom} max={dateTo ?? undefined} />
              <DatePicker label="Até" value={dateTo} onChange={setDateTo} min={dateFrom ?? undefined} />
            </div>
          </div>

          {report && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border p-4 bg-blue-50 border-blue-100">
                <Truck className="w-5 h-5 mb-2 text-blue-700" />
                <p className="text-xl font-black text-blue-700">{totalDeliveries}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-1">Entregas no período</p>
              </div>
              <div className="rounded-2xl border p-4 bg-green-50 border-green-100">
                <TrendingUp className="w-5 h-5 mb-2 text-green-700" />
                <p className="text-xl font-black text-green-700">{fmt(totalValue)}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-1">Valor total entregue</p>
              </div>
            </div>
          )}

          {reportLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-[#C9A227] rounded-full animate-spin" />
            </div>
          ) : !report || report.length === 0 ? (
            <EmptyState icon={Package} title="Nenhuma entrega no período" description="Sem entregas atribuídas a entregadores nesse período." />
          ) : (
            <div className="space-y-2">
              {report.map((r) => (
                <div key={r.driverId} className="flex items-center gap-4 px-4 py-3 bg-white rounded-xl border border-slate-200">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <Bike className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.deliveries} entrega{r.deliveries !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-sm font-black text-[#C9A227] shrink-0">{fmt(r.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <DriverModal
          driver={editingDriver}
          slug={slug}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadDrivers(); }}
        />
      )}

      <Modal isOpen={!!deleteDriver} onClose={() => setDeleteDriver(null)} title="Remover entregador" size="sm">
        <p className="text-sm text-slate-500 -mt-2 mb-4">
          Tem certeza que quer remover <span className="font-bold text-slate-700">{deleteDriver?.name}</span>? Pedidos antigos continuam mostrando o nome dele no histórico.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteDriver(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Remover</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
