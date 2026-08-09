import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "apple-press inline-flex items-center justify-center rounded-full px-3 py-1 text-[0.75rem] font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none transition-all duration-200 ease-out overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-primary/15 text-primary [a&]:hover:bg-primary/25",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/15 text-destructive [a&]:hover:bg-destructive/25",
        success:
          "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 [a&]:hover:bg-emerald-500/25",
        warning:
          "bg-amber-500/15 text-amber-600 dark:text-amber-400 [a&]:hover:bg-amber-500/25",
        outline:
          "border border-border/60 text-foreground bg-background/40 [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
