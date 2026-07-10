import React, { useEffect, useState } from "react";
import { Monitor, X } from "lucide-react";
import { Button, ContentCard, EmptyState } from "../../../../components";
import { apiJson } from "../../../../lib/api";
import { Tenant } from "../../../../types";

export function TableManagement({ 
  tenant, 
  checkoutRequests = [], 
  onClearTable 
}: { 
  tenant: Tenant; 
  checkoutRequests?: Array<{ tableId: string }>;
  onClearTable?: (tableId: string) => void;
}) {
  const [tableRecords, setTableRecords] = useState<Array<{ id: string; label: string }>>([]);
  const [newTable, setNewTable] = useState("");
  const [tablesLoading, setTablesLoading] = useState(true);
  const [addTableError, setAddTableError] = useState("");

  const fetchTables = async () => {
    try {
      const data = await apiJson(`/api/tenants/${tenant.slug}/tables`) as Array<{ id: string; label: string }>;
      setTableRecords(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setTablesLoading(false); }
  };

  useEffect(() => { fetchTables(); }, [tenant.slug]);

  const tables = tableRecords.map(t => t.label);

  const addTable = async () => {
    const label = newTable.trim();
    if (!label || tables.includes(label)) return;
    setAddTableError("");
    try {
      const created = await apiJson(`/api/tenants/${tenant.slug}/tables`, {
        method: "POST",
        body: JSON.stringify({ label }),
      }) as { id: string; label: string };
      setTableRecords(prev => [...prev, created].sort((a, b) => {
        const numA = parseInt(a.label);
        const numB = parseInt(b.label);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.label.localeCompare(b.label);
      }));
      setNewTable("");
    } catch (err: any) {
      setAddTableError(err?.message || "Erro ao adicionar mesa.");
    }
  };

  const removeTable = async (label: string) => {
    const record = tableRecords.find(t => t.label === label);
    if (!record) return;
    setTableRecords(prev => prev.filter(t => t.id !== record.id));
    try {
      await apiJson(`/api/tenants/${tenant.slug}/tables/${record.id}`, { method: "DELETE" });
    } catch { fetchTables(); }
  };

  const menuUrl = `${window.location.origin}/${tenant.slug}/mesa/`;
  const counterUrl = `${window.location.origin}/${tenant.slug}/balcao`;

  return (
    <ContentCard padding="none" className="overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Gestão de QR Codes</h3>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gere códigos para Balcão ou Mesas específicas</p>
      </div>
      
      <div className="p-6 sm:p-8 space-y-10">
        
        {/* Balcão Section */}
        <section className="space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Ponto de Venda Geral</h4>
          <div className="max-w-sm bg-amber-50 border border-amber-100 rounded-[2rem] p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-2xl font-black text-amber-900">Balcão</h4>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pedido sem mesa fixa</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-700">
                <Monitor className="w-5 h-5" />
              </div>
            </div>

            <div className="aspect-square bg-white rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-amber-200 p-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(counterUrl)}`}
                alt="QR Balcão"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                className="flex-1 text-[10px] bg-amber-600 border-amber-600 hover:bg-amber-700"
                onClick={() => {
                  const link = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(counterUrl)}`;
                  window.open(link, '_blank');
                }}
              >
                Imprimir QR Balcão
              </Button>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-100 w-full" />

        {/* Dynamic Tables Section */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Mesas do Salão</h4>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                <input
                  value={newTable}
                  onChange={e => setNewTable(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addTable(); }}
                  placeholder="Nº da Mesa"
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 w-28"
                />
                <Button variant="primary" size="sm" onClick={addTable}>
                  + Adicionar Mesa
                </Button>
              </div>
              {addTableError && <p className="text-[10px] font-bold text-red-500">{addTableError}</p>}
            </div>
          </div>

          {tablesLoading ? (
            <div className="flex items-center justify-center p-16">
              <div className="w-8 h-8 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {tables.map(table => {
              const isRequestingAccount = checkoutRequests.some(r => r.tableId === table);

              return (
                <div 
                  key={table} 
                  className={`bg-white border rounded-3xl p-4 space-y-3 hover:shadow-xl hover:shadow-slate-100 transition-all group relative ${
                    isRequestingAccount 
                      ? "border-red-500 shadow-lg shadow-red-100 animate-pulse" 
                      : "border-zinc-100 hover:border-amber-400"
                  }`}
                >
                  <button 
                    onClick={() => removeTable(table)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  <div className="text-center">
                    <h4 className="text-lg font-black text-slate-800 leading-tight">Mesa {table}</h4>
                    {isRequestingAccount && (
                      <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mt-1">Pediu a Conta!</p>
                    )}
                  </div>

                  <div className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-100">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(menuUrl + table)}`} 
                      alt={`QR Mesa ${table}`}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {isRequestingAccount ? (
                      <button 
                        onClick={() => onClearTable?.(table)}
                        className="text-[9px] font-black uppercase text-white bg-red-600 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                      >
                        Liberar Mesa
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          const link = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(menuUrl + table)}`;
                          window.open(link, '_blank');
                        }}
                        className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 py-2 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        Baixar QR
                      </button>
                    )}
                    <button 
                      onClick={() => window.open(menuUrl + table, '_blank')}
                      className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Testar Link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {tables.length === 0 && (
            <EmptyState
              title="Nenhuma mesa no salão"
              description="Cadastre as mesas para gerar os códigos individuais."
              icon={Monitor}
            />
          )}
          </>
          )}
        </section>
      </div>
    </ContentCard>
  );
}

