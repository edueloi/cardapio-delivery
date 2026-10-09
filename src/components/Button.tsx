import React from "react";
import { cn } from "@/src/lib/utils";
import { Loader2 } from "lucide-react";
import { uiTheme, iconButtonVariants } from "./theme";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  iconLeft?: React.ReactNode;
  /** Alias de iconLeft (API legada). */
  icon?: React.ReactNode;
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
      iconLeft: iconLeftProp,
      icon,
      iconRight,
      fullWidth = false,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const iconLeft = iconLeftProp ?? icon;
    const variants = uiTheme.button;

    const sizes = uiTheme.buttonSize;

    const spinnerSize = size === "lg" ? 16 : size === "md" ? 15 : 13;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "ui-button relative inline-flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap border",
          "font-medium leading-none select-none transition-all duration-150 active:scale-[.98]",
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
      type = "button",
      ...props
    },
    ref
  ) => {
    const variants = iconButtonVariants;

    const sizes = uiTheme.iconButtonSize;

    const spinnerSize = size === "lg" ? 16 : size === "md" ? 15 : 13;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "ui-icon-button inline-flex items-center justify-center shrink-0 border transition-colors duration-150",
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

export default Button;
