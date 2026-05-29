import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Clock, Search, Store, Loader2, AlertCircle, ChevronRight, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import CondominiumMenuView from "./CondominiumMenuView";

interface CondTenant {
  id: string;
  sortOrder: number;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    description: string | null;
    address: string | null;
    isOpen: boolean;
    businessHours: string | null;
    whatsapp: string | null;
  };
}

interface Condominium {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  address: string | null;
  tenants: CondTenant[];
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function isOpen(businessHours: string | null, isOpenFlag: boolean): boolean {
  if (!isOpenFlag) return false;
  if (!businessHours) return true;
  try {
    const hours = JSON.parse(businessHours);
    const dayKey = DAY_KEYS[new Date().getDay()];
    const day = hours[dayKey];
    if (!day?.enabled) return false;
    const [oh, om] = day.open.split(":").map(Number);
    const [ch, cm] = day.close.split(":").map(Number);
    const mins = new Date().getHours() * 60 + new Date().getMinutes();
    return mins >= oh * 60 + om && mins < ch * 60 + cm;
  } catch { return true; }
}

function getTodayHours(businessHours: string | null): string | null {
  if (!businessHours) return null;
  try {
    const hours = JSON.parse(businessHours);
    const dayKey = DAY_KEYS[new Date().getDay()];
    const d = hours[dayKey];
    if (!d?.enabled) return "Fechado hoje";
    return `${d.open}–${d.close}`;
  } catch { return null; }
}

export default function CondominiumPage() {
  const { slug } = useParams<{ slug: string }>();

  const [cond, setCond] = useState<Condominium | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Qual estabelecimento está aberto no cardápio embutido
  const [activeTenant, setActiveTenant] = useState<CondTenant["tenant"] | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/cond/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setCond(data);
      })
      .catch(() => setError("Erro ao carregar o condomínio."))
      .finally(() => setLoading(false));
  }, [slug]);

  const primary = cond?.primaryColor || "#C9A227";

  const filtered = (cond?.tenants ?? []).filter((ct) =>
    ct.tenant.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !cond) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-lg font-semibold text-gray-700">{error ?? "Condomínio não encontrado."}</p>
        <p className="text-sm text-gray-500">Verifique o link e tente novamente.</p>
      </div>
    );
  }

  // Se um tenant está selecionado, renderiza o cardápio embutido
  if (activeTenant) {
    return (
      <CondominiumMenuView
        tenantSlug={activeTenant.slug}
        tenantName={activeTenant.name}
        tenantLogo={activeTenant.logoUrl}
        primaryColor={primary}
        onBack={() => setActiveTenant(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / Banner */}
      <div
        className="relative"
        style={{ background: cond.bannerUrl ? undefined : primary }}
      >
        {cond.bannerUrl && (
          <img
            src={cond.bannerUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div
          className="relative z-10 px-4 pt-10 pb-8"
          style={{ background: cond.bannerUrl ? "rgba(0,0,0,0.45)" : "transparent" }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            {cond.logoUrl ? (
              <img
                src={cond.logoUrl}
                alt={cond.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 shadow-lg flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Store className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black text-white">{cond.name}</h1>
              {cond.description && (
                <p className="text-sm text-white/80 mt-0.5">{cond.description}</p>
              )}
              {cond.address && (
                <p className="text-xs text-white/70 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" /> {cond.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de busca */}
      <div className="max-w-2xl mx-auto px-4 -mt-4 relative z-20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar estabelecimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-3 rounded-2xl bg-white shadow-lg text-sm border border-gray-100 focus:outline-none focus:ring-2 focus:ring-opacity-40"
            style={{ "--tw-ring-color": primary } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Lista de estabelecimentos */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          {filtered.length} {filtered.length === 1 ? "estabelecimento" : "estabelecimentos"}
        </p>

        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center">
                <Store className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-bold">Nenhum estabelecimento encontrado</p>
            </motion.div>
          ) : (
            filtered.map((ct, i) => {
              const open = isOpen(ct.tenant.businessHours, ct.tenant.isOpen);
              const hours = getTodayHours(ct.tenant.businessHours);
              return (
                <motion.button
                  key={ct.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, type: "spring", damping: 24, stiffness: 280 }}
                  onClick={() => setActiveTenant(ct.tenant)}
                  className="w-full flex items-center gap-4 bg-white rounded-3xl shadow-sm border border-gray-100 p-4 mb-3 hover:shadow-lg hover:-translate-y-0.5 active:scale-98 transition-all text-left group"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
                >
                  {/* Logo */}
                  <div className="relative flex-shrink-0">
                    <div className="w-18 h-18 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center shadow-sm"
                      style={{ width: 68, height: 68 }}>
                      {ct.tenant.logoUrl ? (
                        <img src={ct.tenant.logoUrl} alt={ct.tenant.name} className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow ${open ? "bg-green-500" : "bg-red-400"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 text-base leading-tight">{ct.tenant.name}</p>
                    {ct.tenant.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5 leading-relaxed">{ct.tenant.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${open ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {open ? "Aberto" : "Fechado"}
                      </span>
                      {hours && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" /> {hours}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
                    style={{ background: primary + "15" }}>
                    <ChevronRight className="w-4 h-4" style={{ color: primary }} strokeWidth={2.5} />
                  </div>
                </motion.button>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-xs text-gray-400">
        Powered by <span className="font-semibold" style={{ color: primary }}>Delivery</span>
      </div>
    </div>
  );
}
