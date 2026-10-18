import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { EmployeeSelect } from './employee-select';
import { FormField } from './form-field';
import { MoneyInput } from './money-input';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { api, ApiError } from '@/lib/api';
import { todayTashkent } from '@/lib/format';
import { invalidateData } from '@/lib/query';
import type { Advance } from '@/lib/types';

const schema = z.object({
  employeeId: z
    .number({ required_error: 'Xodimni tanlang', invalid_type_error: 'Xodimni tanlang' })
    .int()
    .positive('Xodimni tanlang'),
  amount: z
    .number({ required_error: 'Summani kiriting', invalid_type_error: 'Summani kiriting' })
    .int('Summa butun son boʻlishi kerak')
    .positive('Summa musbat boʻlishi kerak')
    .max(1_000_000_000, 'Summa juda katta'),
  date: z
    .string()
    .min(1, 'Sanani kiriting')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana notoʻgʻri'),
  note: z.string().max(500, 'Izoh 500 belgidan oshmasligi kerak'),
});
type FormValues = z.infer<typeof schema>;

export function AdvanceFormDialog({
  open,
  onOpenChange,
  advance,
  defaultEmployeeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advance?: Advance | null;
  defaultEmployeeId?: number;
}) {
  const isEdit = !!advance;
  const defaults = (): FormValues => ({
    employeeId: (advance?.employeeId ?? defaultEmployeeId) as number,
    amount: advance?.amount as number,
    date: advance?.date ?? todayTashkent(),
    note: advance?.note ?? '',
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });

  useEffect(() => {
    if (open) reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, advance?.id, defaultEmployeeId]);

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const body = { ...v, note: v.note || null };
      return isEdit
        ? api.put<Advance>(`/advances/${advance!.id}`, body)
        : api.post<Advance>('/advances', body);
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Avans yangilandi' : 'Avans qayd etildi');
      onOpenChange(false);
      await invalidateData();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields) {
        for (const [k, msg] of Object.entries(err.fields)) {
          if (k in schema.shape) setError(k as keyof FormValues, { message: msg });
        }
      }
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Avansni tahrirlash' : 'Avans berish'}</DialogTitle>
          <DialogDescription>Barcha avanslar naqd pulda beriladi.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="grid gap-4"
          noValidate
          aria-label="Avans formasi"
        >
          <FormField id="advance-employee" label="Xodim" required error={errors.employeeId?.message}>
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <EmployeeSelect
                  id="advance-employee"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? undefined)}
                  activeOnly
                  keepId={advance?.employeeId}
                  invalid={!!errors.employeeId}
                />
              )}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="advance-amount" label="Summa" required error={errors.amount?.message}>
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <MoneyInput
                    id="advance-amount"
                    placeholder="500 000"
                    aria-invalid={!!errors.amount}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </FormField>
            <FormField id="advance-date" label="Sana" required error={errors.date?.message}>
              <Input id="advance-date" type="date" aria-invalid={!!errors.date} {...register('date')} />
            </FormField>
          </div>
          <FormField id="advance-note" label="Izoh" error={errors.note?.message}>
            <Textarea id="advance-note" rows={2} placeholder="Ixtiyoriy" {...register('note')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
