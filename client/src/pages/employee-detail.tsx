import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { AdvanceFormDialog } from '@/components/advance-form-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmployeeFormDialog } from '@/components/employee-form-dialog';
import { FormField } from '@/components/form-field';
import { MoneyInput } from '@/components/money-input';
import { Pagination } from '@/components/pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, ApiError } from '@/lib/api';
import { currentYearMonth, formatDate, formatMoney, formatPercent, monthKey, monthLabel } from '@/lib/format';
import { invalidateData } from '@/lib/query';
import type {
  Advance,
  AdvanceList,
  EmployeeAdvance,
  EmployeeDetail,
  MonthlySummaryItem,
  SalaryRecord,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const salarySchema = z.object({
  monthlySalary: z
    .number({ required_error: 'Maoshni kiriting', invalid_type_error: 'Maoshni kiriting' })
    .int()
    .min(0, 'Maosh manfiy boʻlishi mumkin emas')
    .max(1_000_000_000, 'Maosh juda katta'),
  effectiveMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Oyni tanlang'),
});
type SalaryValues = z.infer<typeof salarySchema>;

function SalaryDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employee: EmployeeDetail;
}) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SalaryValues>({
    resolver: zodResolver(salarySchema),
    values: open
      ? {
          monthlySalary: employee.currentSalary ?? (undefined as unknown as number),
          effectiveMonth: monthKey(currentYearMonth()),
        }
      : undefined,
  });
  const m = useMutation({
    mutationFn: (v: SalaryValues) => api.post<SalaryRecord>(`/employees/${employee.id}/salary-history`, v),
    onSuccess: async () => {
      toast.success('Maosh saqlandi');
      onOpenChange(false);
      await invalidateData();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fields?.effectiveMonth)
        setError('effectiveMonth', { message: err.fields.effectiveMonth });
      toast.error(err.message);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Oylik maoshni belgilash</DialogTitle>
          <DialogDescription>
            Maosh tanlangan oyning 1-sanasidan boshlab amal qiladi. Oldingi oylar hisobotlari oʻzgarmaydi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => m.mutate(v))} className="grid gap-4" noValidate>
          <FormField id="salary-amount" label="Oylik maosh" required error={errors.monthlySalary?.message}>
            <Controller
              control={control}
              name="monthlySalary"
              render={({ field }) => (
                <MoneyInput
                  id="salary-amount"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? undefined)}
                  aria-invalid={!!errors.monthlySalary}
                />
              )}
            />
          </FormField>
          <FormField
            id="salary-month"
            label="Amal qilish oyi"
            required
            error={errors.effectiveMonth?.message}
          >
            <Input id="salary-month" type="month" {...register('effectiveMonth')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending && <Loader2 className="animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const employeeId = Number(id);
  const [editOpen, setEditOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<Advance | null>(null);
  const [deletingAdvance, setDeletingAdvance] = useState<EmployeeAdvance | null>(null);
  const [deletingSalary, setDeletingSalary] = useState<SalaryRecord | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [advPage, setAdvPage] = useState(1);
  const cur = currentYearMonth();

  const q = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get<EmployeeDetail>(`/employees/${employeeId}`),
    enabled: Number.isInteger(employeeId) && employeeId > 0,
  });
  const summary = useQuery({
    queryKey: ['employee-summary', employeeId],
    queryFn: () =>
      api.get<{ items: MonthlySummaryItem[] }>(`/employees/${employeeId}/monthly-summary`, { months: 12 }),
    enabled: q.isSuccess,
  });
  const advances = useQuery({
    queryKey: ['employee-advances', employeeId, advPage],
    queryFn: () =>
      api.get<AdvanceList & { items: EmployeeAdvance[] }>(`/employees/${employeeId}/advances`, {
        page: advPage,
        pageSize: 10,
      }),
    enabled: q.isSuccess,
    placeholderData: (p) => p,
  });

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/employees/${employeeId}/status`, { isActive }),
    onSuccess: async (_d, isActive) => {
      toast.success(isActive ? 'Xodim faollashtirildi' : 'Xodim nofaol deb belgilandi');
      setStatusOpen(false);
      await invalidateData();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteAdvance = useMutation({
    mutationFn: (aid: number) => api.delete(`/advances/${aid}`),
    onSuccess: async () => {
      toast.success('Avans oʻchirildi');
      setDeletingAdvance(null);
      await invalidateData();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteSalary = useMutation({
    mutationFn: (sid: number) => api.delete(`/employees/${employeeId}/salary-history/${sid}`),
    onSuccess: async () => {
      toast.success('Maosh yozuvi oʻchirildi');
      setDeletingSalary(null);
      await invalidateData();
    },
    onError: (e) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <Card>
        <ErrorState error={q.error ?? new Error('Xodim topilmadi')} onRetry={() => q.refetch()} />
        <div className="pb-6 text-center">
          <Button variant="link" asChild>
            <Link to="/employees">Xodimlar roʻyxatiga qaytish</Link>
          </Button>
        </div>
      </Card>
    );
  }
  const e = q.data;
  const thisMonth = summary.data?.items.find((s) => s.month === monthKey(cur));

  return (
    <div>
      <Link
        to="/employees"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Xodimlar
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{e.fullName}</h1>
            <Badge variant={e.isActive ? 'success' : 'muted'}>{e.isActive ? 'Faol' : 'Nofaol'}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{e.position ?? 'Lavozim koʻrsatilmagan'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Tahrirlash
          </Button>
          <Button variant="outline" onClick={() => setStatusOpen(true)}>
            <Power /> {e.isActive ? 'Nofaol qilish' : 'Faollashtirish'}
          </Button>
          {e.isActive && (
            <Button
              onClick={() => {
                setEditingAdvance(null);
                setAdvanceOpen(true);
              }}
            >
              <Plus /> Avans berish
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Joriy oylik maosh</p>
          <p className="tabular mt-1 text-2xl font-semibold" data-testid="detail-salary">
            {formatMoney(e.currentSalary)}
          </p>
          <Button variant="link" className="h-auto p-0 text-sm" onClick={() => setSalaryOpen(true)}>
            Maoshni oʻzgartirish
          </Button>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{monthLabel(cur)} avanslari</p>
          <p className="tabular mt-1 text-2xl font-semibold" data-testid="detail-advances">
            {formatMoney(thisMonth?.totalAdvances ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatPercent(thisMonth?.advancePercentage ?? 0)} maoshdan
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Toʻlanishi qolgan</p>
          <p
            className={cn(
              'tabular mt-1 text-2xl font-semibold',
              (thisMonth?.remainingSalary ?? 0) < 0 && 'text-destructive',
            )}
            data-testid="detail-remaining"
          >
            {formatMoney(thisMonth?.remainingSalary ?? e.currentSalary ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground">{monthLabel(cur)}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="pt-5">
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Info
              label="Telefon"
              value={
                e.phone ? (
                  <a href={`tel:${e.phone}`} className="hover:underline">
                    {e.phone}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <Info label="Ish boshlagan sana" value={formatDate(e.employmentStartDate)} />
            <Info label="Lavozim" value={e.position ?? '—'} />
            <Info label="Izoh" value={e.notes ?? '—'} />
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="monthly" className="mt-6">
        <TabsList>
          <TabsTrigger value="monthly">Oylik hisob-kitob</TabsTrigger>
          <TabsTrigger value="advances">Avanslar</TabsTrigger>
          <TabsTrigger value="salary">Maosh tarixi</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-4">
          <Card>
            {summary.isLoading ? (
              <TableSkeleton cols={4} />
            ) : summary.isError ? (
              <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
            ) : !summary.data?.items.length ? (
              <EmptyState title="Hisob-kitob maʼlumotlari yoʻq" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oy</TableHead>
                    <TableHead className="text-right">Maosh</TableHead>
                    <TableHead className="text-right">Avanslar</TableHead>
                    <TableHead className="text-right">Qolgan</TableHead>
                    <TableHead className="text-right">Foiz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.data.items.map((s) => (
                    <TableRow key={s.month}>
                      <TableCell className="whitespace-nowrap">
                        <Link
                          to={`/reports?month=${s.month}&employeeId=${employeeId}`}
                          className="hover:underline"
                        >
                          {monthLabel(s.month)}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right">
                        {formatMoney(s.monthlySalary)}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right">
                        {formatMoney(s.totalAdvances)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'tabular whitespace-nowrap text-right font-medium',
                          s.remainingSalary < 0 && 'text-destructive',
                        )}
                      >
                        {formatMoney(s.remainingSalary)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatPercent(s.advancePercentage)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="advances" className="mt-4">
          <Card>
            {advances.isLoading ? (
              <TableSkeleton cols={4} />
            ) : advances.isError ? (
              <ErrorState error={advances.error} onRetry={() => advances.refetch()} />
            ) : !advances.data?.items.length ? (
              <EmptyState title="Avanslar yoʻq" description="Bu xodimga hali avans berilmagan." />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Izoh</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.data.items.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(a.date)}</TableCell>
                        <TableCell className="tabular whitespace-nowrap text-right font-medium">
                          {formatMoney(a.amount)}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                          {a.note ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Avansni tahrirlash"
                            onClick={() => {
                              setEditingAdvance({
                                ...a,
                                employee: { id: e.id, fullName: e.fullName, isActive: e.isActive },
                                updatedAt: a.createdAt,
                              });
                              setAdvanceOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Avansni oʻchirish"
                            onClick={() => setDeletingAdvance(a)}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination
                  page={advances.data.page}
                  pageSize={advances.data.pageSize}
                  total={advances.data.total}
                  onPageChange={setAdvPage}
                />
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Maosh oʻzgarishlari</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setSalaryOpen(true)}>
                <Plus /> Yangi maosh
              </Button>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Davr</TableHead>
                  <TableHead className="text-right">Oylik maosh</TableHead>
                  <TableHead>Kiritilgan</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {e.salaryHistory.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">
                      {monthLabel(s.effectiveMonth)} —{' '}
                      {s.effectiveTo ? monthLabel(s.effectiveTo.slice(0, 7)) : 'hozirgacha'}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-right font-medium">
                      {formatMoney(s.monthlySalary)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(s.createdAt.slice(0, 10))}
                    </TableCell>
                    <TableCell className="text-right">
                      {i < e.salaryHistory.length - 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Maosh yozuvini oʻchirish"
                          onClick={() => setDeletingSalary(s)}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={e} />
      <SalaryDialog open={salaryOpen} onOpenChange={setSalaryOpen} employee={e} />
      <AdvanceFormDialog
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
        advance={editingAdvance}
        defaultEmployeeId={e.id}
      />
      <ConfirmDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title={e.isActive ? 'Xodimni nofaol qilish' : 'Xodimni faollashtirish'}
        description={
          e.isActive
            ? 'Xodim nofaol deb belgilanadi. Uning barcha maosh va avans tarixi saqlanib qoladi.'
            : 'Xodim yana faol xodimlar roʻyxatiga qaytadi.'
        }
        loading={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate(!e.isActive)}
      />
      <ConfirmDialog
        open={!!deletingAdvance}
        onOpenChange={(o) => !o && setDeletingAdvance(null)}
        title="Avansni oʻchirish"
        description={
          deletingAdvance &&
          `${formatDate(deletingAdvance.date)} sanadagi ${formatMoney(deletingAdvance.amount)} avans butunlay oʻchiriladi.`
        }
        confirmLabel="Oʻchirish"
        destructive
        loading={deleteAdvance.isPending}
        onConfirm={() => deletingAdvance && deleteAdvance.mutate(deletingAdvance.id)}
      />
      <ConfirmDialog
        open={!!deletingSalary}
        onOpenChange={(o) => !o && setDeletingSalary(null)}
        title="Maosh yozuvini oʻchirish"
        description={
          deletingSalary &&
          `${monthLabel(deletingSalary.effectiveMonth)} dan amal qilgan ${formatMoney(deletingSalary.monthlySalary)} maosh oʻchiriladi. Bu davr uchun oldingi maosh qoʻllaniladi.`
        }
        confirmLabel="Oʻchirish"
        destructive
        loading={deleteSalary.isPending}
        onConfirm={() => deletingSalary && deleteSalary.mutate(deletingSalary.id)}
      />
    </div>
  );
}
