import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva("w-full rounded-md border px-4 py-3 text-sm [&_svg]:size-4", {
  variants: {
    variant: {
      default: "border-border bg-surface text-surface-foreground",
      destructive: "border-destructive/40 bg-destructive/10 text-destructive",
      success: "border-success/40 bg-success/10 text-success",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type AlertProps = React.ComponentProps<"div"> & VariantProps<typeof alertVariants>;

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="alert-title" className={cn("font-medium leading-none", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="alert-description" className={cn("mt-1 text-muted-foreground [&:first-child]:mt-0", className)} {...props} />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
