import * as React from 'react';
import { Input } from './ui/input';
import { CURRENCY, groupDigits, parseAmount } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}

/** User types 5000000, sees "5 000 000", form receives the number 5000000. */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, ...props }, ref) => (
    <div className="relative">
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        className={cn('tabular pr-14', className)}
        value={value === null || value === undefined ? '' : groupDigits(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
          onChange(parseAmount(digits));
        }}
        {...props}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        {CURRENCY}
      </span>
    </div>
  ),
);
MoneyInput.displayName = 'MoneyInput';
