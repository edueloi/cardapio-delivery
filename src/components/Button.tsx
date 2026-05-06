import React from "react";
import { cn } from "@/src/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      iconLeft,
      iconRight,
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants: Record<string, string> = {
      primary:
        "bg-[#C9A227] border-[#A8841C]/30 text-white hover:bg-[#A8841C] shadow-[0_2px_10px_-3px_rgba(201,162,39,0.3)] hover:shadow-none",
      secondary:
        "bg-[#0D1B3E] border-white/5 text-white hover:bg-[#1a3068] shadow-[0_2px_10px_-3px_rgba(13,27,62,0.3)] hover:shadow-none",
      success:
        "bg-[#4f8d67] border-white/5 text-white hover:bg-[#3d6c50] shadow-[0_2px_10px_-3px_rgba(79,141,103,0.3)] hover:shadow-none",
      danger:
        "bg-[#aa403d] border-white/5 text-white hover:bg-[#7f3431] shadow-[0_2px_10px_-3px_rgba(170,64,61,0.3)] hover:shadow-none",
      outline:
        "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm",
      ghost:
        "bg-transparent border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    };

    const sizes: Record<string, string> = {
      xs: "h-7 min-w-[74px] px-2.5 text-[10px] rounded-lg tracking-wider uppercase font-black",
      sm: "h-8 min-w-[82px] px-3 text-[11px] rounded-xl tracking-wide font-black uppercase",
      md: "h-9 min-w-[90px] px-4 text-xs rounded-xl font-bold tracking-tight",
      lg: "h-11 min-w-[110px] px-6 text-sm rounded-2xl font-bold tracking-tight",
    };

    const spinnerSize = size === "lg" ? 16 : size === "md" ? 15 : 13;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap border-2",
          "font-semibold leading-none select-none transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:shrink-0 [&_svg]:pointer-events-none",
          fullWidth && "w-full",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 size={spinnerSize} className="animate-spin shrink-0" />
        ) : (
          <>
            {iconLeft && (
              <span className="flex shrink-0 items-center justify-center">
                {iconLeft}
              </span>
            )}

            {children !== undefined && children !== null && (
              <span className="inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap leading-none [&>svg]:shrink-0">
                {children}
              </span>
            )}

            {iconRight && (
              <span className="flex shrink-0 items-center justify-center">
                {iconRight}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

// ── IconButton ────────────────────────────────────────────────

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = "ghost",
      size = "md",
      loading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants: Record<string, string> = {
      primary:
        "bg-[#C9A227] border-[#A8841C] text-white hover:bg-[#A8841C] hover:border-[#7a6014]",
      secondary:
        "bg-[#0D1B3E] border-[#1a3068] text-white hover:bg-[#1a3068] hover:border-[#0D1B3E]",
      success:
        "bg-[#4f8d67] border-[#3d6c50] text-white hover:bg-[#3d6c50] hover:border-[#325641]",
      danger:
        "bg-[#aa403d] border-[#7f3431] text-white hover:bg-[#7f3431] hover:border-[#642d2a]",
      outline:
        "bg-white border-[#C9A227] text-[#C9A227] hover:bg-[#fdf8e8] hover:border-[#A8841C] hover:text-[#A8841C]",
      ghost:
        "bg-transparent border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-700",
    };

    const sizes: Record<string, string> = {
      xs: "h-7 w-7 rounded-lg",
      sm: "h-8 w-8 rounded-xl",
      md: "h-9 w-9 rounded-xl",
      lg: "h-11 w-11 rounded-2xl",
    };

    const spinnerSize = size === "lg" ? 16 : size === "md" ? 15 : 13;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center shrink-0 border-2 transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/50 focus-visible:ring-offset-1",
          "disabled:pointer-events-none disabled:opacity-50",
          "[&_svg]:shrink-0 [&_svg]:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 size={spinnerSize} className="animate-spin" />
        ) : (
          children
        )}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";