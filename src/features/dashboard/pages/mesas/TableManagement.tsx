import React, { useEffect, useState } from "react";
import { Monitor, X } from "lucide-react";
import { Button, IconButton, ContentCard, EmptyState, Input, SectionTitle } from "../../../../components";
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
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <SectionTitle title="Gestão de QR Codes" description="Gere códigos para Balcão ou Mesas específicas" icon={Monitor} />
      </div>
      
      <div className="p-4 sm:p-5 space-y-6">
        
        {/* Balcão Section */}
        <section className="space-y-4">
          <h4 className="text-sm font-medium text-slate-800">Ponto de Venda Geral</h4>
          <div className="w-full sm:max-w-md bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center gap-4">
            <div className="w-20 h-20 shrink-0 bg-white rounded-lg flex items-center justify-center border border-blue-200 p-1.5">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(counterUrl)}`}
                alt="QR Balcão"
                className="w-full h-full object-contain mix-blend-multiply"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-slate-900 leading-tight truncate">Balcão</h4>
                  <p className="text-[11px] text-slate-500">Pedido sem mesa fixa</p>
                </div>
              </div>
              <Button
                size="xs"
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
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h4 className="text-sm font-medium text-slate-800">Mesas do Salão</h4>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                <Input
                  value={newTable}
                  onChange={e => setNewTable(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addTable(); }}
                  placeholder="Nº da Mesa"
                  wrapperClassName="w-28"
                />
                <Button variant="primary" size="sm" onClick={addTable}>
                  + Adicionar Mesa
                </Button>
              </div>
              {addTableError && <p className="text-[11px] font-medium text-red-600">{addTableError}</p>}
            </div>
          </div>

          {tablesLoading ? (
            <div className="flex items-center justify-center p-16">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {tables.map(table => {
              const isRequestingAccount = checkoutRequests.some(r => r.tableId === table);

              return (
                <div 
                  key={table} 
                  className={`bg-white border rounded-lg p-4 space-y-3 transition-all group relative ${
                    isRequestingAccount 
                      ? "border-red-500 animate-pulse" 
                      : "border-slate-200 hover:border-blue-400"
                  }`}
                >
                  <IconButton
                    size="sm"
                    variant="danger"
                    aria-label={`Remover mesa ${table}`}
                    onClick={() => removeTable(table)}
                    className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </IconButton>

                  <div className="text-center">
                    <h4 className="text-sm font-medium text-slate-800 leading-tight">Mesa {table}</h4>
                    {isRequestingAccount && (
                      <p className="text-[11px] font-medium text-red-600 mt-1">Pediu a Conta!</p>
                    )}
                  </div>

                  <div className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center p-2 border border-slate-100">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(menuUrl + table)}`} 
                      alt={`QR Mesa ${table}`}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {isRequestingAccount ? (
                      <Button variant="danger" size="xs" fullWidth onClick={() => onClearTable?.(table)}>
                        Liberar Mesa
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        fullWidth
                        onClick={() => {
                          const link = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(menuUrl + table)}`;
                          window.open(link, '_blank');
                        }}
                      >
                        Baixar QR
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" fullWidth onClick={() => window.open(menuUrl + table, '_blank')}>
                      Testar Link
                    </Button>
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

