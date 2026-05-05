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
        "bg-[#2a74ac] border-[#295b85] text-white hover:bg-[#295b85] hover:border-[#264a6c]",
      secondary:
        "bg-[#295b85] border-[#143a59] text-white hover:bg-[#143a59] hover:border-[#0b2942]",
      success:
        "bg-[#4f8d67] border-[#3d6c50] text-white hover:bg-[#3d6c50] hover:border-[#325641]",
      danger:
        "bg-[#aa403d] border-[#7f3431] text-white hover:bg-[#7f3431] hover:border-[#642d2a]",
      outline:
        "bg-white border-[#2a74ac] text-[#2a74ac] hover:bg-[#e6e7e8] hover:border-[#487295] hover:text-[#487295]",
      ghost:
        "bg-transparent border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-700",
    };

    const sizes: Record<string, string> = {
      xs: "h-7 min-w-[74px] px-2.5 text-[11px] rounded-[20px]",
      sm: "h-8 min-w-[82px] px-3 text-[12px] rounded-[20px]",
      md: "h-9 min-w-[90px] px-4 text-[13px] rounded-[20px]",
      lg: "h-10 min-w-[110px] px-5 text-[14px] rounded-[20px]",
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
        "bg-[#2a74ac] border-[#295b85] text-white hover:bg-[#295b85] hover:border-[#264a6c]",
      secondary:
        "bg-[#295b85] border-[#143a59] text-white hover:bg-[#143a59] hover:border-[#0b2942]",
      success:
        "bg-[#4f8d67] border-[#3d6c50] text-white hover:bg-[#3d6c50] hover:border-[#325641]",
      danger:
        "bg-[#aa403d] border-[#7f3431] text-white hover:bg-[#7f3431] hover:border-[#642d2a]",
      outline:
        "bg-white border-[#2a74ac] text-[#2a74ac] hover:bg-[#e6e7e8] hover:border-[#487295] hover:text-[#487295]",
      ghost:
        "bg-transparent border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-700",
    };

    const sizes: Record<string, string> = {
      xs: "h-7 w-7 rounded-[10px]",
      sm: "h-8 w-8 rounded-[10px]",
      md: "h-9 w-9 rounded-[12px]",
      lg: "h-10 w-10 rounded-[12px]",
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