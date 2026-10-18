import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-accent text-accent-foreground',
      success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
      muted: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20',
      destructive: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
