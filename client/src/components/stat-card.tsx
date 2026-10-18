import type { ReactNode } from 'react';
import { Card } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon,
  hint,
  loading,
  tone = 'default',
  testId,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  hint?: ReactNode;
  loading?: boolean;
  tone?: 'default' | 'negative';
  testId?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-32" />
          ) : (
            <p
              data-testid={testId}
              className={cn(
                'tabular mt-1 break-words text-xl font-semibold 2xl:text-2xl',
                tone === 'negative' && 'text-destructive',
              )}
            >
              {value}
            </p>
          )}
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="rounded-lg bg-accent p-2.5 text-accent-foreground [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      </div>
    </Card>
  );
}
