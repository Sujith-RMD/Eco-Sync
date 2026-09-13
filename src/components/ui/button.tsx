import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Shared class recipe so links and buttons look identical. */
export function buttonClasses(options?: ButtonStyleOptions) {
  const { variant = "primary", size = "md", className } = options ?? {};
  return cn(
    "group/btn relative inline-flex select-none items-center justify-center gap-2 font-mono uppercase tracking-[0.22em] transition-all duration-200",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid",
    "disabled:pointer-events-none disabled:opacity-40",
    size === "sm" && "px-3.5 py-2 text-[11px]",
    size === "md" && "px-5 py-2.5 text-[12.5px]",
    size === "lg" && "px-7 py-3.5 text-[13px]",
    variant === "primary" &&
      "bg-acid text-abyss-950 hover:shadow-[0_0_34px_-6px_color-mix(in_oklab,var(--color-acid)_65%,transparent)] hover:brightness-110 active:brightness-95",
    variant === "ghost" &&
      "border border-line bg-abyss-900/50 text-mist hover:border-acid/60 hover:text-acid",
    variant === "danger" &&
      "border border-alert/50 bg-alert/10 text-alert hover:bg-alert/20",
    className,
  );
}

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStyleOptions {}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <button className={buttonClasses({ variant, size, className })} {...props} />
  );
}
