import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { addMonths, currentYearMonth, MONTHS, type YearMonth } from '@/lib/format';

export function MonthPicker({ value, onChange }: { value: YearMonth; onChange: (v: YearMonth) => void }) {
  const cur = currentYearMonth();
  const years: number[] = [];
  for (let y = cur.year + 1; y >= Math.min(cur.year - 6, value.year); y--) years.push(y);
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Oy va yilni tanlash">
      <Button
        variant="outline"
        size="icon"
        aria-label="Oldingi oy"
        onClick={() => onChange(addMonths(value, -1))}
      >
        <ChevronLeft />
      </Button>
      <Select value={String(value.month)} onValueChange={(m) => onChange({ ...value, month: Number(m) })}>
        <SelectTrigger className="w-[120px]" aria-label="Oy">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={name} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(value.year)} onValueChange={(y) => onChange({ ...value, year: Number(y) })}>
        <SelectTrigger className="w-[90px]" aria-label="Yil">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        aria-label="Keyingi oy"
        onClick={() => onChange(addMonths(value, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
