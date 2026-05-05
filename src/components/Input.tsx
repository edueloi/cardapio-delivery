import React from "react";
import { cn } from "@/src/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Input — Design System
// Altura: h-10 mobile / h-11 sm+  (usa classe ds-input do CSS global)
// ─────────────────────────────────────────────────────────────────────────────

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  addonLeft?: React.ReactNode;
  addonRight?: React.ReactNode;
  wrapperClassName?: string;
  size?: "sm" | "md" | "lg";
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      iconLeft,
      iconRight,
      addonLeft,
      addonRight,
      wrapperClassName,
      className,
      id,
      maxLength,
      value,
      size = "md",
      ...props
    },
    ref
  ) => {
    const inputId = id ?? `input-${Math.random().toString(36).slice(2, 7)}`;
    const currentLen = typeof value === "string" ? value.length : 0;
    const nearLimit = maxLength !== undefined && currentLen >= maxLength * 0.85;

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="ds-label">
              {label}
            </label>
            {maxLength !== undefined && (
              <span className={cn(
                "text-[10px] font-bold tabular-nums transition-colors",
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
            "rounded-[10px] bg-zinc-50 border border-zinc-200 shadow-sm",
            "focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/10 focus-within:bg-white",
            error && "border-red-400 focus-within:border-red-500 focus-within:ring-red-500/10 bg-red-50/30",
            size === "sm" && "h-9"
          )}
        >
          {addonLeft && (
            <div className="flex items-center justify-center bg-zinc-100 px-3.5 border-r border-zinc-200 text-xs font-black text-zinc-500 whitespace-nowrap select-none shrink-0 group-focus-within:bg-zinc-50/50 transition-colors">
              {addonLeft}
            </div>
          )}

          <div className="relative flex flex-1 items-center">
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
                "w-full bg-transparent px-3 py-2.5 outline-none",
                "text-sm text-zinc-800 placeholder:text-zinc-400 font-bold tracking-tight",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                size === "sm" && "py-1.5 text-xs",
                iconLeft && (size === "sm" ? "pl-8" : "pl-9"),
                iconRight && (size === "sm" ? "pr-8" : "pr-9"),
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
            <div className="flex items-center justify-center bg-zinc-100 px-3.5 border-l border-zinc-200 text-xs font-black text-zinc-500 whitespace-nowrap select-none shrink-0 group-focus-within:bg-zinc-50/50 transition-colors">
              {addonRight}
            </div>
          )}
        </div>

        {error && (
          <p className="text-[11px] font-semibold text-red-500">{error}</p>
        )}
        {hint && !error && (
          <p className="text-[11px] text-zinc-400">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, wrapperClassName, className, id, maxLength, value, ...props }, ref) => {
    const inputId = id ?? `textarea-${Math.random().toString(36).slice(2, 7)}`;
    const currentLen = typeof value === "string" ? value.length : 0;
    const nearLimit = maxLength !== undefined && currentLen >= maxLength * 0.85;

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="ds-label">
              {label}
            </label>
            {maxLength !== undefined && (
              <span className={cn(
                "text-[10px] font-bold tabular-nums transition-colors",
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
            "w-full rounded-[10px] border border-zinc-200 bg-zinc-50 px-3 py-2.5",
            "text-sm text-zinc-800 placeholder:text-zinc-400 font-medium",
            "outline-none resize-none transition-all duration-150",
            "focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10 focus:bg-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[80px]",
            error && "border-red-400 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30",
            className
          )}
          {...props}
        />

        {error && (
          <p className="text-[11px] font-semibold text-red-500">{error}</p>
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
  wrapperClassName?: string;
  options?: { value: string | number; label: string; disabled?: boolean }[];
  placeholder?: string;
  size?: "sm" | "md" | "lg";
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, hint, wrapperClassName, className, id, options, placeholder, size = "md", children, ...props },
    ref
  ) => {
    const inputId = id ?? `select-${Math.random().toString(36).slice(2, 7)}`;

    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="ds-label">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              "ds-input appearance-none pr-8 cursor-pointer",
              size === "sm" && "h-8 py-0 px-2 text-[11px] font-black uppercase tracking-widest",
              size === "lg" && "h-14 px-4 text-base",
              error && "border-red-400 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30",
              className
            )}
            {...props}
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

          {/* Chevron */}
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {error && (
          <p className="text-[11px] font-semibold text-red-500">{error}</p>
        )}
        {hint && !error && (
          <p className="text-[11px] text-zinc-400">{hint}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
