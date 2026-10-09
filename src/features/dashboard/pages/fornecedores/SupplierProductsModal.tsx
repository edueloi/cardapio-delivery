/**
 * Modal para gerenciar os produtos/insumos que um fornecedor oferece.
 * Usa supplier_catalog_items como armazenamento.
 * Tem lista pré-definida por categoria + busca + criação manual.
 */
import { useState, useMemo } from "react";
import { Check, Package, Plus, Search, Tag } from "lucide-react";
import { apiJson } from "../../../../lib/api";
import { Button, EmptyState, Input, Modal, ModalFooter, Select, Tabs } from "../../../../components";
import type { SupplierCatalogItem } from "../../../../types";

// ─── Preset catalog ──────────────────────────────────────────────────────────

interface PresetItem {
  name: string;
  unit: string;
}

interface PresetCategory {
  label: string;
  emoji: string;
  items: PresetItem[];
}

export const PRESET_CATALOG: PresetCategory[] = [
  {
    label: "Bebidas — Refrigerantes",
    emoji: "🥤",
    items: [
      { name: "Coca-Cola 350ml", unit: "lata" },
      { name: "Coca-Cola 600ml", unit: "un" },
      { name: "Coca-Cola 1L", unit: "un" },
      { name: "Coca-Cola 2L", unit: "un" },
      { name: "Coca-Cola Zero 350ml", unit: "lata" },
      { name: "Coca-Cola Zero 2L", unit: "un" },
      { name: "Pepsi 350ml", unit: "lata" },
      { name: "Pepsi 2L", unit: "un" },
      { name: "Guaraná Antarctica 350ml", unit: "lata" },
      { name: "Guaraná Antarctica 2L", unit: "un" },
      { name: "Guaraná Kuat 350ml", unit: "lata" },
      { name: "Guaraná Kuat 2L", unit: "un" },
      { name: "Fanta Laranja 350ml", unit: "lata" },
      { name: "Fanta Uva 350ml", unit: "lata" },
      { name: "Schweppes Citrus 350ml", unit: "lata" },
      { name: "Sprite 350ml", unit: "lata" },
      { name: "Sukita Laranja 2L", unit: "un" },
      { name: "Sukita Uva 2L", unit: "un" },
      { name: "Dolly Guaraná 2L", unit: "un" },
      { name: "Dolly Cola 2L", unit: "un" },
      { name: "Tubaína Laranja 2L", unit: "un" },
      { name: "Tubaína Uva 2L", unit: "un" },
      { name: "Jesus Cola 2L", unit: "un" },
      { name: "Mineirinho 2L", unit: "un" },
      { name: "Refrigerante Genérico 2L", unit: "un" },
    ],
  },
  {
    label: "Bebidas — Águas e Sucos",
    emoji: "💧",
    items: [
      { name: "Água Mineral 500ml", unit: "un" },
      { name: "Água Mineral 1,5L", unit: "un" },
      { name: "Água com Gás 500ml", unit: "un" },
      { name: "Água com Gás 1L", unit: "un" },
      { name: "Suco Del Valle Laranja 200ml", unit: "un" },
      { name: "Suco Del Valle Uva 200ml", unit: "un" },
      { name: "Suco Del Valle Goiaba 200ml", unit: "un" },
      { name: "Suco Integral Laranja 1L", unit: "un" },
      { name: "Polpa de Fruta Morango 100g", unit: "un" },
      { name: "Polpa de Fruta Maracujá 100g", unit: "un" },
      { name: "Polpa de Fruta Açaí 100g", unit: "un" },
      { name: "Isotônico Gatorade 500ml", unit: "un" },
      { name: "Energético Red Bull 250ml", unit: "lata" },
    ],
  },
  {
    label: "Bebidas — Alcoólicas",
    emoji: "🍺",
    items: [
      { name: "Cerveja Brahma 350ml", unit: "lata" },
      { name: "Cerveja Skol 350ml", unit: "lata" },
      { name: "Cerveja Heineken 350ml", unit: "lata" },
      { name: "Cerveja Corona 350ml", unit: "garrafa" },
      { name: "Cerveja Stella Artois 350ml", unit: "lata" },
      { name: "Caipirinha (cachaça) 1L", unit: "garrafa" },
      { name: "Vinho Tinto Seco 750ml", unit: "garrafa" },
      { name: "Vinho Branco Seco 750ml", unit: "garrafa" },
    ],
  },
  {
    label: "Panificação — Farinhas",
    emoji: "🌾",
    items: [
      { name: "Farinha de Trigo Especial 1kg", unit: "kg" },
      { name: "Farinha de Trigo Comum 1kg", unit: "kg" },
      { name: "Farinha de Trigo 5kg", unit: "saco" },
      { name: "Farinha de Trigo 25kg", unit: "saco" },
      { name: "Farinha de Rosca 500g", unit: "pacote" },
      { name: "Farinha de Milho Flocada 500g", unit: "pacote" },
      { name: "Fubá de Milho 1kg", unit: "kg" },
      { name: "Amido de Milho (Maisena) 500g", unit: "caixa" },
      { name: "Polvilho Azedo 500g", unit: "pacote" },
      { name: "Polvilho Doce 500g", unit: "pacote" },
      { name: "Farinha de Mandioca 1kg", unit: "kg" },
    ],
  },
  {
    label: "Panificação — Fermentos e Açúcares",
    emoji: "🍞",
    items: [
      { name: "Fermento Biológico Fresco 15g", unit: "tablete" },
      { name: "Fermento Biológico Seco 10g", unit: "sachê" },
      { name: "Fermento Biológico Seco 500g", unit: "pote" },
      { name: "Fermento Químico em Pó 100g", unit: "lata" },
      { name: "Açúcar Refinado 1kg", unit: "kg" },
      { name: "Açúcar Cristal 1kg", unit: "kg" },
      { name: "Açúcar Demerara 1kg", unit: "kg" },
      { name: "Açúcar de Confeiteiro 1kg", unit: "kg" },
      { name: "Açúcar Mascavo 1kg", unit: "kg" },
      { name: "Mel Puro 250g", unit: "un" },
      { name: "Glucose de Milho 500g", unit: "un" },
    ],
  },
  {
    label: "Panificação — Pães e Massas",
    emoji: "🥖",
    items: [
      { name: "Pão de Hambúrguer (pct 8un)", unit: "pacote" },
      { name: "Pão de Hot Dog (pct 8un)", unit: "pacote" },
      { name: "Pão Sírio 500g", unit: "pacote" },
      { name: "Pão de Forma Integral", unit: "pacote" },
      { name: "Pão de Forma Branco", unit: "pacote" },
      { name: "Pão Francês (kg)", unit: "kg" },
      { name: "Massa de Pastel 500g", unit: "pacote" },
      { name: "Massa de Lasanha 500g", unit: "caixa" },
      { name: "Macarrão Espaguete 500g", unit: "caixa" },
      { name: "Macarrão Parafuso 500g", unit: "caixa" },
    ],
  },
  {
    label: "Laticínios",
    emoji: "🧀",
    items: [
      { name: "Muçarela Fatiada 500g", unit: "pacote" },
      { name: "Muçarela em Barra 1kg", unit: "kg" },
      { name: "Muçarela em Barra 2kg", unit: "kg" },
      { name: "Queijo Prato Fatiado 500g", unit: "pacote" },
      { name: "Queijo Prato em Barra 1kg", unit: "kg" },
      { name: "Queijo Parmesão Ralado 100g", unit: "un" },
      { name: "Queijo Cheddar Fatiado 150g", unit: "pacote" },
      { name: "Requeijão Cremoso 200g", unit: "un" },
      { name: "Catupiry Original 200g", unit: "un" },
      { name: "Catupiry Original 1kg", unit: "kg" },
      { name: "Cream Cheese 150g", unit: "un" },
      { name: "Cream Cheese 1kg", unit: "kg" },
      { name: "Manteiga com Sal 200g", unit: "tablete" },
      { name: "Manteiga sem Sal 200g", unit: "tablete" },
      { name: "Margarina 500g", unit: "pote" },
      { name: "Creme de Leite 200g", unit: "caixinha" },
      { name: "Leite Condensado 395g", unit: "lata" },
      { name: "Leite Integral 1L", unit: "caixinha" },
      { name: "Leite Desnatado 1L", unit: "caixinha" },
      { name: "Iogurte Natural 170g", unit: "un" },
    ],
  },
  {
    label: "Carnes — Bovino",
    emoji: "🥩",
    items: [
      { name: "Carne Moída (patinho) kg", unit: "kg" },
      { name: "Carne Moída (acém) kg", unit: "kg" },
      { name: "Hambúrguer Artesanal 180g", unit: "un" },
      { name: "Hambúrguer Congelado 100g (cx12)", unit: "cx" },
      { name: "Picanha kg", unit: "kg" },
      { name: "Fraldinha kg", unit: "kg" },
      { name: "Costela Bovina kg", unit: "kg" },
      { name: "Contra-filé kg", unit: "kg" },
      { name: "Alcatra kg", unit: "kg" },
      { name: "Linguiça Bovina kg", unit: "kg" },
    ],
  },
  {
    label: "Carnes — Aves e Suíno",
    emoji: "🍗",
    items: [
      { name: "Peito de Frango kg", unit: "kg" },
      { name: "Coxa e Sobrecoxa kg", unit: "kg" },
      { name: "Frango Inteiro kg", unit: "kg" },
      { name: "Bacon em Tiras 250g", unit: "pacote" },
      { name: "Bacon em Cubos 250g", unit: "pacote" },
      { name: "Linguiça Calabresa kg", unit: "kg" },
      { name: "Linguiça Toscana kg", unit: "kg" },
      { name: "Presunto Cozido Fatiado 200g", unit: "pacote" },
      { name: "Mortadela Fatiada 200g", unit: "pacote" },
      { name: "Salame Italiano 100g", unit: "pacote" },
    ],
  },
  {
    label: "Frios e Embutidos",
    emoji: "🌭",
    items: [
      { name: "Pepperoni 200g", unit: "pacote" },
      { name: "Calabresa Fatiada 200g", unit: "pacote" },
      { name: "Salsicha Hot Dog 500g", unit: "pacote" },
      { name: "Ovo de Galinha (dz)", unit: "dúzia" },
      { name: "Ovo de Codorna 30un", unit: "bandeja" },
    ],
  },
  {
    label: "Hortifruti — Verduras e Legumes",
    emoji: "🥬",
    items: [
      { name: "Alface Crespa un", unit: "un" },
      { name: "Alface Lisa un", unit: "un" },
      { name: "Rúcula (maço)", unit: "maço" },
      { name: "Tomate kg", unit: "kg" },
      { name: "Cebola kg", unit: "kg" },
      { name: "Alho kg", unit: "kg" },
      { name: "Batata Inglesa kg", unit: "kg" },
      { name: "Batata Doce kg", unit: "kg" },
      { name: "Cenoura kg", unit: "kg" },
      { name: "Pimentão Vermelho kg", unit: "kg" },
      { name: "Pimentão Amarelo kg", unit: "kg" },
      { name: "Pepino kg", unit: "kg" },
      { name: "Abobrinha kg", unit: "kg" },
      { name: "Brócolis kg", unit: "kg" },
    ],
  },
  {
    label: "Hortifruti — Frutas",
    emoji: "🍓",
    items: [
      { name: "Morango kg", unit: "kg" },
      { name: "Banana Nanica (penca)", unit: "kg" },
      { name: "Maçã Fuji kg", unit: "kg" },
      { name: "Limão Tahiti kg", unit: "kg" },
      { name: "Laranja Pera kg", unit: "kg" },
      { name: "Abacaxi un", unit: "un" },
      { name: "Manga Palmer kg", unit: "kg" },
      { name: "Uva Itália kg", unit: "kg" },
      { name: "Melancia kg", unit: "kg" },
    ],
  },
  {
    label: "Mercearia — Óleos e Temperos",
    emoji: "🫙",
    items: [
      { name: "Óleo de Soja 900ml", unit: "un" },
      { name: "Azeite de Oliva 500ml", unit: "un" },
      { name: "Vinagre de Álcool 750ml", unit: "un" },
      { name: "Sal Refinado 1kg", unit: "kg" },
      { name: "Pimenta-do-reino moída 50g", unit: "un" },
      { name: "Orégano 20g", unit: "un" },
      { name: "Molho de Tomate 340g", unit: "lata" },
      { name: "Extrato de Tomate 340g", unit: "lata" },
      { name: "Ketchup Heinz 397g", unit: "un" },
      { name: "Mostarda Heinz 370g", unit: "un" },
      { name: "Maionese Hellmanns 500g", unit: "un" },
      { name: "Shoyu Kikkoman 200ml", unit: "un" },
      { name: "Tabasco 60ml", unit: "un" },
    ],
  },
  {
    label: "Mercearia — Grãos e Cereais",
    emoji: "🌽",
    items: [
      { name: "Arroz Branco Longo 5kg", unit: "saco" },
      { name: "Arroz Integral 5kg", unit: "saco" },
      { name: "Feijão Carioca 1kg", unit: "kg" },
      { name: "Feijão Preto 1kg", unit: "kg" },
      { name: "Lentilha 500g", unit: "pacote" },
      { name: "Grão-de-bico 500g", unit: "pacote" },
      { name: "Aveia em Flocos 250g", unit: "pacote" },
      { name: "Chia 200g", unit: "pacote" },
      { name: "Granola 500g", unit: "pacote" },
      { name: "Quinoa 250g", unit: "pacote" },
    ],
  },
  {
    label: "Confeitaria e Chocolates",
    emoji: "🍫",
    items: [
      { name: "Chocolate em Pó 50% 200g", unit: "un" },
      { name: "Achocolatado em Pó 400g", unit: "lata" },
      { name: "Chocolate Ao Leite Barra 1kg", unit: "kg" },
      { name: "Chocolate Meio Amargo Barra 1kg", unit: "kg" },
      { name: "Chocolate Branco Barra 1kg", unit: "kg" },
      { name: "Granulado Chocolate 500g", unit: "pacote" },
      { name: "Confeito Colorido 100g", unit: "pacote" },
      { name: "Pasta de Amendoim 500g", unit: "pote" },
      { name: "Nutella 650g", unit: "pote" },
      { name: "Coco Ralado 100g", unit: "pacote" },
      { name: "Paçoca Rolha 20un", unit: "cx" },
      { name: "Wafer Baunilha 115g", unit: "pacote" },
    ],
  },
  {
    label: "Embalagens",
    emoji: "📦",
    items: [
      { name: "Caixa de Pizza P (cx100)", unit: "cx" },
      { name: "Caixa de Pizza M (cx100)", unit: "cx" },
      { name: "Caixa de Pizza G (cx100)", unit: "cx" },
      { name: "Embalagem Marmita G (cx100)", unit: "cx" },
      { name: "Embalagem Marmita M (cx100)", unit: "cx" },
      { name: "Saco Plástico para Delivery (pct100)", unit: "pct" },
      { name: "Copo Descartável 180ml (pct50)", unit: "pct" },
      { name: "Copo Descartável 300ml (pct50)", unit: "pct" },
      { name: "Prato Descartável 20cm (pct50)", unit: "pct" },
      { name: "Garfo/Faca Descartável (pct50)", unit: "pct" },
      { name: "Papel Manteiga 40x60cm (pct100)", unit: "pct" },
      { name: "Papel Alumínio 30cmx7,5m", unit: "rolo" },
      { name: "Filme PVC 30cmx30m", unit: "rolo" },
    ],
  },
  {
    label: "Limpeza",
    emoji: "🧹",
    items: [
      { name: "Detergente Ypê 500ml", unit: "un" },
      { name: "Detergente Concentrado 5L", unit: "galão" },
      { name: "Desinfetante Pinho 1L", unit: "un" },
      { name: "Álcool 70% 1L", unit: "un" },
      { name: "Água Sanitária 1L", unit: "un" },
      { name: "Sabão em Barra (cx12)", unit: "cx" },
      { name: "Sabonete Líquido 500ml", unit: "un" },
      { name: "Papel Toalha 2 rolos", unit: "pct" },
      { name: "Papel Higiênico (pct4)", unit: "pct" },
      { name: "Esponja de Limpeza (pct3)", unit: "pct" },
      { name: "Luva Descartável M (cx100)", unit: "cx" },
      { name: "Touca Descartável (cx100)", unit: "cx" },
    ],
  },
  {
    label: "Açaí e Sorvetes",
    emoji: "🫐",
    items: [
      { name: "Açaí Puro 1kg", unit: "kg" },
      { name: "Açaí com Guaraná 1kg", unit: "kg" },
      { name: "Açaí 10kg (balde)", unit: "balde" },
      { name: "Sorvete Creme 2L", unit: "pote" },
      { name: "Sorvete Chocolate 2L", unit: "pote" },
      { name: "Sorvete Morango 2L", unit: "pote" },
      { name: "Leite em Pó Integral 400g", unit: "lata" },
      { name: "Leite de Coco 200ml", unit: "caixinha" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const PRODUCT_TABS = [
  { id: "catalogo", label: "Catálogo", icon: Package },
  { id: "personalizados", label: "Personalizados", icon: Tag },
] as const;
type ProductTabId = (typeof PRODUCT_TABS)[number]["id"];

interface Props {
  supplierId: string | null;
  supplierName: string;
  slug: string;
  existingItems: SupplierCatalogItem[];
  onClose: () => void;
  onSaved: (items: SupplierCatalogItem[]) => void;
  // When supplierId is null (new supplier), called instead of API save
  onPendingSelected?: (names: { name: string; unit: string }[]) => void;
}

export default function SupplierProductsModal({ supplierId, supplierName, slug, existingItems, onClose, onSaved, onPendingSelected }: Props) {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("todas");
  const [tab, setTab] = useState<ProductTabId>("catalogo");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(existingItems.map(i => i.name)));
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [saving, setSaving] = useState(false);

  // Todos os itens do preset flat
  const allPresetItems = useMemo(() =>
    PRESET_CATALOG.flatMap(cat => cat.items.map(item => ({ ...item, category: cat.label, emoji: cat.emoji }))),
    []
  );

  // Itens filtrados
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allPresetItems.filter(item => {
      const matchCat = activeCat === "todas" || item.category === activeCat;
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [allPresetItems, search, activeCat]);

  const customSelected = useMemo(
    () => [...selected].filter(name => !allPresetItems.find(p => p.name === name)),
    [selected, allPresetItems]
  );

  const categoryOptions = useMemo(
    () => [{ value: "todas", label: "Todas as categorias" }, ...PRESET_CATALOG.map(cat => ({ value: cat.label, label: `${cat.emoji} ${cat.label}` }))],
    []
  );

  function toggle(name: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function addCustom() {
    if (!customName.trim()) return;
    setSelected(prev => new Set([...prev, customName.trim()]));
    setCustomName("");
    setCustomUnit("");
  }

  async function handleSave() {
    // New supplier (no ID yet) — just pass selected names back to parent
    if (!supplierId) {
      const items = [...selected].map(name => {
        const preset = allPresetItems.find(p => p.name === name);
        return { name, unit: preset?.unit ?? "" };
      });
      onPendingSelected?.(items);
      onClose();
      return;
    }

    setSaving(true);
    try {
      const currentNames = new Set(existingItems.map(i => i.name));
      const selectedNames = selected;

      const toDelete = existingItems.filter(i => !selectedNames.has(i.name));
      const toAdd = [...selectedNames].filter(name => !currentNames.has(name));

      await Promise.all([
        ...toDelete.map(i =>
          apiJson(`/api/tenants/${slug}/suppliers/${supplierId}/catalog/${i.id}`, { method: "DELETE" })
            .catch(() => null)
        ),
        ...toAdd.map(name => {
          const preset = allPresetItems.find(p => p.name === name);
          return apiJson(`/api/tenants/${slug}/suppliers/${supplierId}/catalog`, {
            method: "POST",
            body: JSON.stringify({ name, unit: preset?.unit ?? null, price: null, notes: null }),
          }).catch(() => null);
        }),
      ]);

      const updated = await apiJson<SupplierCatalogItem[]>(`/api/tenants/${slug}/suppliers/${supplierId}/catalog`);
      onSaved(Array.isArray(updated) ? updated : []);
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = selected.size;
  const tabItems = PRODUCT_TABS.map(t => t.id === "personalizados" ? { ...t, badge: customSelected.length || undefined } : t);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Produtos do fornecedor — ${supplierName}`}
      subtitle={`${selectedCount} produto${selectedCount !== 1 ? "s" : ""} selecionado${selectedCount !== 1 ? "s" : ""}`}
      size="lg"
      footer={
        <ModalFooter align="between">
          <p className="text-xs text-slate-500">
            {selectedCount} produto{selectedCount !== 1 ? "s" : ""} selecionado{selectedCount !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving} iconLeft={<Check size={14} />}>Salvar produtos</Button>
          </div>
        </ModalFooter>
      }
    >
      <Tabs<ProductTabId> items={tabItems} value={tab} onChange={setTab} label="Produtos do fornecedor">
        {tab === "catalogo" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                autoFocus
                iconLeft={<Search size={14} />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produto (ex: Coca-Cola, farinha, muçarela...)"
              />
              <Select
                aria-label="Categoria"
                value={activeCat}
                onChange={e => { setActiveCat(e.target.value); setSearch(""); }}
                options={categoryOptions}
              />
            </div>

            <div className="space-y-1.5">
              {filtered.length === 0 && (
                <EmptyState
                  icon={Search}
                  title="Nenhum produto encontrado"
                  description="Tente outro termo ou adicione manualmente na aba Personalizados."
                />
              )}
              {filtered.map(item => {
                const isSelected = selected.has(item.name);
                return (
                  <label
                    key={item.name}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                      isSelected
                        ? "border-blue-200 bg-blue-50/50"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${isSelected ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggle(item.name)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-800">{item.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{item.emoji} {item.category.split(" — ")[1] ?? item.category}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{item.unit}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {tab === "personalizados" && (
          <div className="space-y-3">
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Adicionar produto personalizado</p>
              <p className="text-[11px] text-slate-500">Não encontrou na lista? Cadastre aqui.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  wrapperClassName="flex-1"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustom()}
                  placeholder="Nome do produto *"
                />
                <Input
                  wrapperClassName="sm:w-28"
                  value={customUnit}
                  onChange={e => setCustomUnit(e.target.value)}
                  placeholder="Unidade"
                />
                <Button onClick={addCustom} disabled={!customName.trim()} iconLeft={<Plus size={14} />}>Adicionar</Button>
              </div>
            </div>

            {customSelected.length === 0 ? (
              <EmptyState
                icon={Tag}
                title="Nenhum produto personalizado"
                description="Os produtos que você adicionar manualmente aparecem aqui."
              />
            ) : (
              <div className="space-y-1.5">
                {customSelected.map(name => (
                  <label key={name} className="flex cursor-pointer items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2.5 transition-all">
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-blue-600 bg-blue-600">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-800">{name}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Tag className="h-3 w-3 text-blue-600" />
                        <span className="text-[11px] text-blue-700">personalizado</span>
                      </div>
                    </div>
                    <input type="checkbox" className="hidden" checked onChange={() => toggle(name)} />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </Tabs>
    </Modal>
  );
}
