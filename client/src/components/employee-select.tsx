import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { api } from '@/lib/api';
import type { EmployeeOption } from '@/lib/types';

export function useEmployeeOptions() {
  return useQuery({
    queryKey: ['employee-options'],
    queryFn: () => api.get<{ items: EmployeeOption[] }>('/employees/options'),
    select: (d) => d.items,
  });
}

export function EmployeeSelect({
  id,
  value,
  onChange,
  includeAll,
  activeOnly,
  keepId,
  invalid,
  className,
}: {
  id?: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  includeAll?: boolean;
  activeOnly?: boolean;
  keepId?: number;
  invalid?: boolean;
  className?: string;
}) {
  const { data = [], isLoading } = useEmployeeOptions();
  const options = activeOnly ? data.filter((e) => e.isActive || e.id === keepId) : data;
  return (
    <Select
      value={value ? String(value) : includeAll ? 'all' : ''}
      onValueChange={(v) => onChange(v === 'all' ? null : Number(v))}
      disabled={isLoading}
    >
      <SelectTrigger id={id} aria-invalid={invalid} className={className} aria-label="Xodim">
        <SelectValue placeholder={isLoading ? 'Yuklanmoqda…' : 'Xodimni tanlang'} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">Barcha xodimlar</SelectItem>}
        {options.map((e) => (
          <SelectItem key={e.id} value={String(e.id)}>
            {e.fullName}
            {!e.isActive && ' (nofaol)'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
