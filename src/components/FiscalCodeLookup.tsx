import { useEffect, useState } from "react";
import { ListFilter, Loader2, Search } from "lucide-react";
import { apiFetch } from "@/src/lib/api";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";
import { Alert } from "./Alert";
import { cn } from "@/src/lib/utils";

export type FiscalCodeItem = { code: string; formatted_code?: string; description: string };

interface FiscalCodeLookupProps {
  onSelect: (item: FiscalCodeItem) => void;
  className?: string;
}

/** Consulta ao catálogo NCM vigente (BrasilAPI via servidor). A escolha final é do emissor. */
export function FiscalCodeLookup({ onSelect, className }: FiscalCodeLookupProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<FiscalCodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const term = search.trim();
    if (term.length < 2) {
      setItems([]);
      setError("");
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await apiFetch(`/api/fiscal-codes/ncm?search=${encodeURIComponent(term)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível consultar os códigos.");
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (requestError) {
        setItems([]);
        setError(requestError instanceof Error ? requestError.message : "Não foi possível consultar os códigos.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, search]);

  return (
    <>
      <Button variant="outline" size="sm" iconLeft={<ListFilter size={14} />} onClick={() => setOpen(true)} className={cn("shrink-0", className)}>
        Consultar
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Consultar NCM" subtitle="Catálogo NCM vigente" size="lg">
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-500">Pesquise por código ou descrição do produto antes de emitir a NFC-e.</p>
          <Input autoFocus iconLeft={<Search size={16} />} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: 8517, chocolate, cabo..." />
          {search.trim().length < 2 && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">Digite ao menos 2 caracteres para buscar no catálogo NCM.</p>}
          {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={22} /></div>}
          {error && <Alert variant="error">{error}</Alert>}
          {!loading && !error && items.length > 0 && (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {items.map((item) => (
                <button key={`${item.code}-${item.description}`} type="button" onClick={() => { onSelect(item); setOpen(false); }}
                  className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-blue-50">
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700">{item.formatted_code || item.code}</span>
                  <span className="text-xs leading-relaxed text-slate-600">{item.description}</span>
                </button>
              ))}
            </div>
          )}
          {!loading && !error && items.length === 0 && search.trim().length >= 2 && (
            <p className="py-6 text-center text-xs text-slate-400">Nenhum código encontrado para esta busca.</p>
          )}
        </div>
      </Modal>
    </>
  );
}

export default FiscalCodeLookup;
