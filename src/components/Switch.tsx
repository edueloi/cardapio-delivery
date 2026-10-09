import React from "react";
import { cn } from "@/src/lib/utils";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Alias de onCheckedChange (API legada). */
  onChange?: (checked: boolean) => void;
  label?: string;
  description?: string;
  accent?: string;
  size?: "sm" | "md";
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange: onCheckedChangeProp, onChange, label, description, accent: _accent, size = "sm", className, disabled, onClick, ...props }, ref) => {
    const onCheckedChange = onCheckedChangeProp ?? onChange;
    const control = (
      <button
        {...props}
        aria-label={props["aria-label"] ?? label}
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !disabled) {
            onCheckedChange?.(!checked);
          }
        }}
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          size === "sm" ? "h-4 w-7" : "h-5 w-9",
          checked
            ? "border-blue-600 bg-blue-600 shadow-none"
            : "border-zinc-200 bg-zinc-200",
          className
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 rounded-full bg-white shadow-sm transition-all duration-200",
            size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
            checked 
              ? (size === "sm" ? "left-3.5" : "left-[18px]") 
              : "left-1"
          )}
        />
      </button>
    );
    if (!label && !description) return control;
    return (
      <div className="flex items-center gap-2.5">
        {control}
        <div className="min-w-0">
          {label && <p className="text-xs font-medium leading-tight text-slate-800">{label}</p>}
          {description && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{description}</p>}
        </div>
      </div>
    );
  }
);

Switch.displayName = "Switch";

export function SwitchGroup({ label, children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {label && <p className="text-xs font-medium text-slate-700">{label}</p>}
      <div className="divide-y divide-slate-100">
        {React.Children.map(children, (child, i) => <div className={cn(i > 0 && "pt-3", "pb-3 last:pb-0")}>{child}</div>)}
      </div>
    </div>
  );
}
