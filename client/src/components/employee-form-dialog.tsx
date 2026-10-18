import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { api, ApiError } from '@/lib/api';
import { currentYearMonth, monthKey, monthLabel, todayTashkent } from '@/lib/format';
import { invalidateData } from '@/lib/query';
import type { Employee, EmployeeDetail } from '@/lib/types';

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'F.I.Sh. kamida 2 belgidan iborat boʻlishi kerak')
    .max(150, 'F.I.Sh. juda uzun'),
  phone: z
    .string()
    .trim()
    .max(30, 'Telefon raqami juda uzun')
    .regex(/^[+\d\s()-]*$/, 'Telefon raqami notoʻgʻri'),
  position: z.string().trim().max(100, 'Lavozim juda uzun'),
  employmentStartDate: z.string().min(1, 'Ish boshlash sanasini kiriting'),
  isActive: z.boolean(),
  notes: z.string().max(1000, 'Izoh 1000 belgidan oshmasligi kerak'),
  monthlySalary: z
    .number({ required_error: 'Oylik maoshni kiriting', invalid_type_error: 'Oylik maoshni kiriting' })
    .int()
    .min(0, 'Maosh manfiy boʻlishi mumkin emas')
    .max(1_000_000_000, 'Maosh juda katta'),
  salaryEffectiveMonth: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeDetail | null;
  onSaved?: (e: Employee) => void;
}) {
  const isEdit = !!employee;
  const cur = currentYearMonth();
  const defaults = (): FormValues => ({
    fullName: employee?.fullName ?? '',
    phone: employee?.phone ?? '',
    position: employee?.position ?? '',
    employmentStartDate: employee?.employmentStartDate ?? todayTashkent(),
    isActive: employee?.isActive ?? true,
    notes: employee?.notes ?? '',
    monthlySalary: (employee
      ? (employee.currentSalary ?? employee.latestSalary?.monthlySalary)
      : undefined) as number,
    salaryEffectiveMonth: monthKey(cur),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const body = {
        fullName: values.fullName,
        phone: values.phone || null,
        position: values.position || null,
        employmentStartDate: values.employmentStartDate,
        isActive: values.isActive,
        notes: values.notes || null,
        monthlySalary: values.monthlySalary,
        ...(isEdit ? { salaryEffectiveMonth: values.salaryEffectiveMonth } : {}),
      };
      return isEdit
        ? api.put<Employee>(`/employees/${employee!.id}`, body)
        : api.post<Employee>('/employees', body);
    },
    onSuccess: async (saved) => {
      toast.success(isEdit ? 'Xodim maʼlumotlari saqlandi' : 'Xodim qoʻshildi');
      await invalidateData();
      onOpenChange(false);
      onSaved?.(saved);
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

  const salaryChanged =
    isEdit && watch('monthlySalary') !== (employee?.currentSalary ?? employee?.latestSalary?.monthlySalary);
  const monthOptions = Array.from({ length: 15 }, (_, i) => {
    const idx = cur.year * 12 + cur.month - 1 + 2 - i;
    return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Xodimni tahrirlash' : 'Yangi xodim qoʻshish'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Xodim maʼlumotlari va oylik maoshini yangilang.'
              : 'Xodim maʼlumotlari va oylik maoshini kiriting.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="grid gap-4"
          noValidate
          aria-label="Xodim formasi"
        >
          <FormField id="fullName" label="F.I.Sh." required error={errors.fullName?.message}>
            <Input
              id="fullName"
              placeholder="Masalan: Ali Valiyev"
              aria-invalid={!!errors.fullName}
              {...register('fullName')}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="phone" label="Telefon raqami" error={errors.phone?.message}>
              <Input
                id="phone"
                type="tel"
                placeholder="+998 90 123 45 67"
                aria-invalid={!!errors.phone}
                {...register('phone')}
              />
            </FormField>
            <FormField id="position" label="Lavozim" error={errors.position?.message}>
              <Input id="position" placeholder="Masalan: Sotuvchi" {...register('position')} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="monthlySalary" label="Oylik maosh" required error={errors.monthlySalary?.message}>
              <Controller
                control={control}
                name="monthlySalary"
                render={({ field }) => (
                  <MoneyInput
                    id="monthlySalary"
                    placeholder="5 000 000"
                    aria-invalid={!!errors.monthlySalary}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </FormField>
            <FormField
              id="employmentStartDate"
              label="Ish boshlagan sana"
              required
              error={errors.employmentStartDate?.message}
            >
              <Input
                id="employmentStartDate"
                type="date"
                aria-invalid={!!errors.employmentStartDate}
                {...register('employmentStartDate')}
              />
            </FormField>
          </div>
          {isEdit && salaryChanged && (
            <FormField
              id="salaryEffectiveMonth"
              label="Yangi maosh qaysi oydan amal qiladi"
              hint="Oldingi oylar hisobotlari eski maosh bilan saqlanib qoladi."
            >
              <Controller
                control={control}
                name="salaryEffectiveMonth"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="salaryEffectiveMonth">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((m) => (
                        <SelectItem key={monthKey(m)} value={monthKey(m)}>
                          {monthLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}
          <FormField id="isActive" label="Holati">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Select
                  value={field.value ? 'active' : 'inactive'}
                  onValueChange={(v) => field.onChange(v === 'active')}
                >
                  <SelectTrigger id="isActive">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Faol</SelectItem>
                    <SelectItem value="inactive">Nofaol</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField id="notes" label="Izoh" error={errors.notes?.message}>
            <Textarea id="notes" rows={2} placeholder="Qoʻshimcha maʼlumot" {...register('notes')} />
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
