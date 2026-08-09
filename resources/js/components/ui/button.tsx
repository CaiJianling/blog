import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "apple-press cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_14px_-2px_rgba(0,113,227,0.25)] hover:brightness-105",
        destructive:
          "bg-destructive text-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_14px_-2px_rgba(255,59,48,0.25)] hover:brightness-105 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "bg-background/60 backdrop-blur-sm border border-border hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground backdrop-blur-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground backdrop-blur-sm",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-5 py-2 has-[>svg]:px-4 text-[0.9375rem]",
        sm: "h-8 rounded-full px-4 text-xs has-[>svg]:px-3",
        lg: "h-11 rounded-full px-7 text-[1rem] font-medium has-[>svg]:px-5",
        xl: "h-12 rounded-full px-8 text-[1.0625rem] font-semibold has-[>svg]:px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
