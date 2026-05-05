import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X, Check, Search, Plus } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  subtitle?: string;
  /** Group name — options with the same group are shown under a shared header */
  group?: string;
  /** Short badge displayed on the right (e.g. price, tag) */
  badge?: string;
  /** Tailwind color classes for the badge background+text (default amber) */
  badgeColor?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  multiple?: boolean;
  allowCustom?: boolean;
  onCustomAdd?: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

function normalizeStr(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Groups filtered options by their `group` field, preserving order of first appearance */
function groupOptions(opts: ComboboxOption[]): { group: string | null; items: ComboboxOption[] }[] {
  const groups: { group: string | null; items: ComboboxOption[] }[] = [];
  const groupMap = new Map<string | null, ComboboxOption[]>();

  for (const opt of opts) {
    const key = opt.group ?? null;
    if (!groupMap.has(key)) {
      const arr: ComboboxOption[] = [];
      groupMap.set(key, arr);
      groups.push({ group: key, items: arr });
    }
    groupMap.get(key)!.push(opt);
  }
  return groups;
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  multiple = false,
  allowCustom = false,
  onCustomAdd,
  size = "sm",
  className,
  disabled = false,
  emptyMessage = "Nenhum resultado encontrado.",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [openUpward, setOpenUpward] = useState(false);

  const selectedValues: string[] = multiple
    ? Array.isArray(value) ? value : value ? [value] : []
    : value ? [value as string] : [];

  const filtered = options.filter(o =>
    normalizeStr(o.label).includes(normalizeStr(search)) ||
    (o.subtitle && normalizeStr(o.subtitle).includes(normalizeStr(search))) ||
    (o.group && normalizeStr(o.group).includes(normalizeStr(search)))
  );

  const grouped = groupOptions(filtered);
  const hasGroups = options.some(o => o.group);

  const canAddCustom =
    allowCustom &&
    search.trim().length > 0 &&
    !options.some(o => normalizeStr(o.label) === normalizeStr(search.trim()));

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 300;
    const goUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    setOpenUpward(goUp);
    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      ...(goUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = (optValue: string) => {
    if (multiple) {
      const current = Array.isArray(value) ? value : value ? [value] : [];
      if (current.includes(optValue)) {
        onChange(current.filter(v => v !== optValue));
      } else {
        onChange([...current, optValue]);
      }
    } else {
      onChange(optValue === (value as string) ? "" : optValue);
      setOpen(false);
      setSearch("");
    }
  };

  const handleRemove = (e: React.MouseEvent, optValue: string) => {
    e.stopPropagation();
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      onChange(current.filter(v => v !== optValue));
    } else {
      onChange("");
    }
  };

  const handleCustomAdd = () => {
    if (!search.trim()) return;
    onCustomAdd?.(search.trim());
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  const selectedLabels = selectedValues
    .map(v => options.find(o => o.value === v)?.label || v)
    .filter(Boolean);

  const sizeClasses = {
    sm: "text-xs px-3 py-2 min-h-[38px]",
    md: "text-sm px-3 py-2.5 min-h-[42px]",
  };

  /* ── Group header icon colours ── */
  const GROUP_STYLES: Record<string, string> = {
    "Serviços":  "text-amber-600 bg-amber-50 border-amber-200",
    "Pacotes":   "text-violet-600 bg-violet-50 border-violet-200",
  };
  const GROUP_DOT: Record<string, string> = {
    "Serviços": "bg-amber-400",
    "Pacotes":  "bg-violet-400",
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) setOpen(v => !v); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!disabled) setOpen(v => !v); }
          handleKeyDown(e);
        }}
        className={cn(
          "w-full flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-left transition-all cursor-pointer select-none",
          "focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400",
          disabled && "opacity-50 cursor-not-allowed",
          sizeClasses[size],
          open && "ring-2 ring-amber-400/40 border-amber-400"
        )}
      >
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {selectedLabels.length === 0 ? (
            <span className="text-zinc-400 truncate">{placeholder}</span>
          ) : multiple ? (
            selectedLabels.map((label, i) => (
              <span
                key={selectedValues[i]}
                className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md px-1.5 py-0.5 text-[10px] font-medium max-w-full"
              >
                <span className="truncate max-w-[120px]">{label}</span>
                <button
                  type="button"
                  onClick={e => handleRemove(e, selectedValues[i])}
                  className="shrink-0 hover:text-red-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))
          ) : (
            <span className="truncate text-zinc-900 font-semibold text-xs">{selectedLabels[0]}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!multiple && selectedValues.length > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(""); }}
              className="p-0.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown
            size={14}
            className={cn(
              "text-zinc-400 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </div>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className={cn(
            "bg-white border border-zinc-200 rounded-xl shadow-2xl overflow-hidden",
            openUpward ? "flex flex-col-reverse" : "flex flex-col"
          )}
        >
          {/* Search */}
          <div className={cn(
            "flex items-center gap-2 px-3 border-zinc-100 bg-white",
            openUpward ? "border-t pt-2 pb-1.5" : "border-b pb-2 pt-2"
          )}>
            <Search size={12} className="text-zinc-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 text-xs outline-none text-zinc-700 placeholder:text-zinc-400 bg-transparent"
              onKeyDown={e => {
                if (e.key === "Escape") { setOpen(false); setSearch(""); }
                if (e.key === "Enter" && canAddCustom) handleCustomAdd();
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-zinc-300 hover:text-zinc-500 transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-[240px]">
            {filtered.length === 0 && !canAddCustom ? (
              <div className="px-3 py-5 text-xs text-zinc-400 text-center">{emptyMessage}</div>
            ) : (
              <>
                {hasGroups
                  /* ── Grouped rendering ── */
                  ? grouped.map(({ group, items }, gi) => (
                    <div key={group ?? `g-${gi}`}>
                      {/* Group header */}
                      {group && (
                        <div className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 sticky top-0 bg-white border-b",
                          gi > 0 && "border-t",
                          "border-zinc-100"
                        )}>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            GROUP_DOT[group] ?? "bg-zinc-400"
                          )} />
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border",
                            GROUP_STYLES[group] ?? "text-zinc-500 bg-zinc-50 border-zinc-200"
                          )}>
                            {group}
                          </span>
                          <span className="text-[9px] text-zinc-400 ml-auto">{items.length}</span>
                        </div>
                      )}

                      {/* Items */}
                      {items.map(opt => {
                        const isSelected = selectedValues.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelect(opt.value)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                              "hover:bg-amber-50",
                              isSelected && "bg-amber-50/60"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all",
                              isSelected ? "bg-amber-500 border-amber-500" : "border-zinc-300"
                            )}>
                              {isSelected && <Check size={10} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-zinc-800 truncate">{opt.label}</div>
                              {opt.subtitle && (
                                <div className="text-[10px] text-zinc-400 truncate">{opt.subtitle}</div>
                              )}
                            </div>
                            {opt.badge && (
                              <span className={cn(
                                "text-[9px] font-black px-1.5 py-0.5 rounded-md border shrink-0",
                                opt.badgeColor ?? "bg-zinc-50 text-zinc-500 border-zinc-200"
                              )}>
                                {opt.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))

                  /* ── Flat rendering (no groups) ── */
                  : filtered.map(opt => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                          "hover:bg-amber-50",
                          isSelected && "bg-amber-50/60"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-all",
                          isSelected ? "bg-amber-500 border-amber-500" : "border-zinc-300"
                        )}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-zinc-800 truncate">{opt.label}</div>
                          {opt.subtitle && (
                            <div className="text-[10px] text-zinc-400 truncate">{opt.subtitle}</div>
                          )}
                        </div>
                        {opt.badge && (
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded-md border shrink-0",
                            opt.badgeColor ?? "bg-zinc-50 text-zinc-500 border-zinc-200"
                          )}>
                            {opt.badge}
                          </span>
                        )}
                      </button>
                    );
                  })
                }

                {canAddCustom && (
                  <button
                    type="button"
                    onClick={handleCustomAdd}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-amber-50 border-t border-zinc-100"
                  >
                    <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                      <Plus size={9} className="text-amber-600" />
                    </div>
                    <span className="text-xs text-amber-700 font-medium">
                      Adicionar "{search.trim()}"
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Combobox;
