import React from "react";
import { cn } from "@/src/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Input — Design System
// Altura padrão: 34px. Labels e campos base pertencem a ui/styles.css.
// ─────────────────────────────────────────────────────────────────────────────

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  hintClassName?: string;
  /** Estado visual do campo (API legada). */
  status?: "success" | "error" | "default";
  iconLeft?: React.ReactNode;
  /** Alias de iconLeft (API legada). */
  leftIcon?: React.ReactNode;
  /** Mantido por compatibilidade; o visual é único. */
  accent?: string;
  iconRight?: React.ReactNode;
  addonLeft?: React.ReactNode;
  addonRight?: React.ReactNode;
  wrapperClassName?: string;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      hintClassName,
      status,
      iconLeft: iconLeftProp,
      leftIcon,
      accent: _accent,
      iconRight,
      addonLeft,
      addonRight,
      wrapperClassName,
      className,
      id,
      maxLength,
      showCount = true,
      value,
      size = "md",
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const iconLeft = iconLeftProp ?? leftIcon;
    const currentLen = typeof value === "string" ? value.length : 0;
    const nearLimit = maxLength !== undefined && currentLen >= maxLength * 0.85;

    return (
      <div className={cn("flex min-w-0 flex-col gap-1", wrapperClassName)}>
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="ds-label">
              {label}
            </label>
            {showCount && maxLength !== undefined && (
              <span className={cn(
                "text-[11px] font-medium tabular-nums transition-colors",
                currentLen >= maxLength ? "text-red-500" : nearLimit ? "text-amber-500" : "text-zinc-400"
              )}>
                {currentLen}/{maxLength}
              </span>
            )}
          </div>
        )}

        <div
          className={cn(
            "group relative flex items-stretch overflow-hidden transition-all duration-200",
            "rounded-lg bg-white border border-slate-200",
            "focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:bg-white",
            (error || status === "error") && "border-red-400 focus-within:border-red-500 focus-within:ring-red-500/10 bg-red-50/30"
          )}
        >
          {addonLeft && (
            <div className={cn(
              "flex items-center justify-center bg-zinc-100 px-3.5 border-r border-zinc-200 text-xs font-medium text-zinc-500 whitespace-nowrap select-none shrink-0 group-focus-within:bg-zinc-50/50 transition-colors",
              size === "sm" && "px-2 text-[11px]",
              size === "lg" && "px-5 text-sm"
            )}>
              {addonLeft}
            </div>
          )}

          <div className="relative flex min-w-0 flex-1 items-center">
            {iconLeft && (
              <span className="pointer-events-none absolute left-3 text-zinc-400 shrink-0 z-10">
                {iconLeft}
              </span>
            )}

            <input
              ref={ref}
              id={inputId}
              maxLength={maxLength}
              value={value}
              className={cn(
                "w-full min-w-0 h-[34px] bg-transparent px-2.5 py-1.5 outline-none",
                "text-[13px] text-slate-800 placeholder:text-slate-400 font-medium",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                size === "sm" && "h-8 py-1 text-xs",
                size === "lg" && "h-10 py-2 text-sm",
                iconLeft && "pl-9",
                iconRight && "pr-9",
                className
              )}
              {...props}
            />

            {iconRight && (
              <span className="absolute right-3 text-zinc-400 shrink-0 z-10 flex items-center">
                {iconRight}
              </span>
            )}
          </div>

          {addonRight && (
            <div className={cn(
              "flex items-center justify-center bg-zinc-100 px-3.5 border-l border-zinc-200 text-xs font-medium text-zinc-500 whitespace-nowrap select-none shrink-0 group-focus-within:bg-zinc-50/50 transition-colors",
              size === "sm" && "px-2 text-[11px]",
              size === "lg" && "px-5 text-sm"
            )}>
              {addonRight}
            </div>
          )}
        </div>

        {error && (
          <p className="text-[11px] font-medium text-red-500">{error}</p>
        )}
        {hint && !error && (
          <p className={cn("text-[11px] text-zinc-400", hintClassName)}>{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// ─── CurrencyInput ────────────────────────────────────────────────────────────
// Campo de valor em reais com máscara "tipo caixa eletrônico": os dígitos
// digitados entram sempre pela direita (centavos), then formata como 0,00.
// `value`/`onChange` trabalham com string decimal (ex: "12.50"), igual a um
// input number comum — só a exibição em tela é mascarada.
interface CurrencyInputProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  value: string | number;
  onChange: (value: string) => void;
}

function centsToDecimalString(cents: string): string {
  const digitsOnly = cents.replace(/\D/g, "");
  const num = Number(digitsOnly || "0") / 100;
  return num.toFixed(2);
}

function decimalStringToDisplay(value: string | number): string {
  const num = typeof value === "number" ? value : parseFloat(value);
  if (!isFinite(num)) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, addonLeft = "R$", ...props }, ref) => {
    const [display, setDisplay] = React.useState(() => decimalStringToDisplay(value));

    // Sincroniza quando o valor externo muda (ex: carregar produto para edição)
    // sem sobrescrever enquanto o usuário está digitando.
    const [focused, setFocused] = React.useState(false);
    React.useEffect(() => {
      if (!focused) setDisplay(decimalStringToDisplay(value));
    }, [value, focused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const decimal = centsToDecimalString(e.target.value);
      setDisplay(decimalStringToDisplay(decimal));
      onChange(decimal);
    };

    return (
      <Input
        ref={ref}
        addonLeft={addonLeft}
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";


// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, wrapperClassName, className, id, maxLength, value, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const currentLen = typeof value === "string" ? value.length : 0;
    const nearLimit = maxLength !== undefined && currentLen >= maxLength * 0.85;

    return (
      <div className={cn("flex min-w-0 flex-col gap-1", wrapperClassName)}>
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="ds-label">
              {label}
            </label>
            {maxLength !== undefined && (
              <span className={cn(
                "text-[11px] font-medium tabular-nums transition-colors",
                currentLen >= maxLength ? "text-red-500" : nearLimit ? "text-amber-500" : "text-zinc-400"
              )}>
                {currentLen}/{maxLength}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={inputId}
          maxLength={maxLength}
          value={value}
          className={cn(
            "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5",
            "text-sm text-zinc-800 placeholder:text-zinc-400 font-medium",
            "outline-none resize-none transition-all duration-150",
            "focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 focus:bg-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[80px]",
            error && "border-red-400 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30",
            className
          )}
          {...props}
        />

        {error && (
          <p className="text-[11px] font-medium text-red-500">{error}</p>
        )}
        {hint && !error && (
          <p className="text-[11px] text-zinc-400">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  wrapperClassName?: string;
  options?: { value: string | number; label: string; disabled?: boolean }[];
  placeholder?: string;
  size?: "sm" | "md" | "lg";
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, hint, iconLeft, iconRight, wrapperClassName, className, id, options, placeholder, size = "md", children, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className={cn("flex min-w-0 flex-col gap-1", wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="ds-label">
            {label}
          </label>
        )}

        <div className="relative">
          {iconLeft && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 shrink-0 z-10">
              {iconLeft}
            </span>
          )}

          <select
            ref={ref}
            id={inputId}
            className={cn(
              "ds-input appearance-none pr-8 cursor-pointer",
              iconLeft && "pl-9",
              iconRight && "pr-9",
              size === "sm" && "h-8 py-0 px-2 text-xs font-medium",
              size === "lg" && "h-10 px-3 text-sm",
              error && "border-red-400 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30",
              className
            )}
            {...props}
            // O recuo vai inline porque o CSS base de .ds-input ganha de pl-9 e o ícone ficava por cima do texto.
            style={{ ...(iconLeft ? { paddingLeft: '2.5rem' } : null), ...(iconRight ? { paddingRight: '3.25rem' } : null), ...props.style }}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          {/* Chevron / IconRight */}
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 flex items-center gap-2">
            {iconRight}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {error && (
          <p className="text-[11px] font-medium text-red-500">{error}</p>
        )}
        {hint && !error && (
          <p className="text-[11px] text-zinc-400">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
