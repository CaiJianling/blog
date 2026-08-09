import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground/80 selection:bg-primary/20 selection:text-foreground flex min-h-[100px] w-full rounded-2xl border border-border/60 bg-background/50 backdrop-blur-sm px-4 py-3 text-[0.9375rem] leading-relaxed transition-all duration-200 ease-out outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        "focus:border-ring/80 focus:bg-background focus:ring-4 focus:ring-ring/20",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
