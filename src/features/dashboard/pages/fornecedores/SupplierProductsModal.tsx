/**
 * Modal para gerenciar os produtos/insumos que um fornecedor oferece.
 * Usa supplier_catalog_items como armazenamento.
 * Tem lista pré-definida por categoria + busca + criação manual.
 */
import { useState, useMemo } from "react";
import { Check, Plus, Search, X, Tag } from "lucide-react";
import { apiJson } from "../../../../lib/api";
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set(existingItems.map(i => i.name)));
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);

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
    setShowCustomForm(false);
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#0A1628] px-6 py-4 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#C9A227]/70">Produtos do fornecedor</p>
              <h2 className="text-base font-black text-white">{supplierName}</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/60 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1.5 bg-[#C9A227]/20 border border-[#C9A227]/30 rounded-xl px-3 py-1.5">
                <Check className="w-3.5 h-3.5 text-[#C9A227]" />
                <span className="text-xs font-black text-[#C9A227]">{selectedCount} produto{selectedCount !== 1 ? "s" : ""} selecionado{selectedCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produto (ex: Coca-Cola, farinha, muçarela...)"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227]"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-5 py-2 border-b border-slate-100 overflow-x-auto shrink-0">
          <div className="flex gap-1.5 min-w-max">
            <button
              onClick={() => setActiveCat("todas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeCat === "todas" ? "bg-[#0A1628] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
            >
              Todas
            </button>
            {PRESET_CATALOG.map(cat => (
              <button
                key={cat.label}
                onClick={() => { setActiveCat(cat.label); setSearch(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeCat === cat.label ? "bg-[#0A1628] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                <span>{cat.emoji}</span>
                {cat.label.split(" — ")[1] ?? cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {/* Custom form */}
          {showCustomForm ? (
            <div className="bg-[#C9A227]/5 border border-[#C9A227]/20 rounded-2xl p-4 mb-3 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-[#C9A227]">Adicionar produto personalizado</p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustom()}
                  placeholder="Nome do produto *"
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227] bg-white"
                />
                <input
                  value={customUnit}
                  onChange={e => setCustomUnit(e.target.value)}
                  placeholder="Unidade"
                  className="w-24 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227] bg-white"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCustomForm(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button onClick={addCustom} disabled={!customName.trim()} className="flex-1 py-2 rounded-xl bg-[#C9A227] text-white text-sm font-black disabled:opacity-50 transition-colors">Adicionar</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomForm(true)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl hover:border-[#C9A227] hover:bg-[#C9A227]/5 transition-all group mb-2"
            >
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 group-hover:border-[#C9A227]/30 flex items-center justify-center shrink-0 transition-colors">
                <Plus className="w-4 h-4 text-slate-400 group-hover:text-[#C9A227] transition-colors" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Adicionar produto personalizado</p>
                <p className="text-xs text-slate-400">Não encontrou na lista? Cadastre aqui</p>
              </div>
            </button>
          )}

          {/* Custom selected items not in preset */}
          {[...selected].filter(name => !allPresetItems.find(p => p.name === name)).map(name => (
            <label key={name} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#C9A227]/30 bg-[#C9A227]/5 cursor-pointer transition-all">
              <div className="w-5 h-5 rounded-md border-2 border-[#C9A227] flex items-center justify-center shrink-0" style={{ background: "#C9A227" }}>
                <Check className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Tag className="w-3 h-3 text-[#C9A227]" />
                  <span className="text-[10px] font-black text-[#C9A227] uppercase tracking-wider">personalizado</span>
                </div>
              </div>
              <input type="checkbox" className="hidden" checked onChange={() => toggle(name)} />
            </label>
          ))}

          {/* Preset items */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-400">Nenhum produto encontrado</p>
              <p className="text-xs text-slate-300 mt-1">Tente outro termo ou adicione manualmente</p>
            </div>
          )}
          {filtered.map(item => {
            const isSelected = selected.has(item.name);
            return (
              <label
                key={item.name}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? "border-[#C9A227]/40 bg-[#C9A227]/5"
                    : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "border-[#C9A227]" : "border-slate-300"}`}
                  style={isSelected ? { background: "#C9A227" } : {}}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggle(item.name)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{item.emoji} {item.category.split(" — ")[1] ?? item.category}</p>
                </div>
                <span className="text-xs font-bold text-slate-400 shrink-0">{item.unit}</span>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {selectedCount} produto{selectedCount !== 1 ? "s" : ""} selecionado{selectedCount !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] hover:bg-[#b8911f] text-white text-sm font-black transition-colors disabled:opacity-60"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              Salvar produtos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
