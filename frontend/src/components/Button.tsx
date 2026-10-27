"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

import { buttonClasses, type ButtonSize, type ButtonVariant } from "./ui/button-classes";

export { buttonClasses, type ButtonSize, type ButtonVariant };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const Spinner = ({ className }: { className?: string }) => (
  <svg
    className={clsx("animate-spin", className)}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        className={buttonClasses(
          variant,
          size,
          clsx("font-medium disabled:cursor-not-allowed", fullWidth && "w-full", className),
        )}
        {...props}
      >
        {loading && (
          <Spinner
            className={clsx({
              "h-3.5 w-3.5": size === "sm",
              "h-4 w-4": size === "md",
              "h-5 w-5": size === "lg",
            })}
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
