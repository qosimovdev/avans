import { useMutation, useQuery } from '@tanstack/react-query';
import { HandCoins, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AdvanceFormDialog } from '@/components/advance-form-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmployeeSelect } from '@/components/employee-select';
import { MonthPicker } from '@/components/month-picker';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { currentYearMonth, formatDate, formatMoney, monthKey, monthLabel, parseMonthKey } from '@/lib/format';
import { invalidateData } from '@/lib/query';
import type { Advance, AdvanceList } from '@/lib/types';

export default function AdvancesPage() {
  const [params, setParams] = useSearchParams();
  // Period mode: a month (default) or a custom date range
  const mode = params.get('from') || params.get('to') ? 'range' : 'month';
  const ym = parseMonthKey(params.get('month')) ?? currentYearMonth();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const employeeId = Number(params.get('employeeId')) || null;
  const sort = params.get('sort') ?? 'date_desc';
  const page = Number(params.get('page') ?? 1) || 1;
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(search.trim());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Advance | null>(null);
  const [deleting, setDeleting] = useState<Advance | null>(null);

  const update = (patch: Record<string, string | null>, resetPage = true) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        if (resetPage) next.delete('page');
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced) update({ q: debounced || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const query = {
    page,
    pageSize: 20,
    sort,
    employeeId,
    search: debounced,
    ...(mode === 'month' ? { month: monthKey(ym) } : { from, to }),
  };
  const q = useQuery({
    queryKey: ['advances', query],
    queryFn: () => api.get<AdvanceList>('/advances', query),
    placeholderData: (prev) => prev,
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/advances/${id}`),
    onSuccess: async () => {
      toast.success('Avans oʻchirildi');
      setDeleting(null);
      await invalidateData();
    },
    onError: (e) => toast.error(e.message),
  });

  const periodLabel =
    mode === 'month' ? monthLabel(ym) : `${from ? formatDate(from) : '…'} — ${to ? formatDate(to) : '…'}`;
  const hasFilters = !!(employeeId || debounced);

  return (
    <div>
      <PageHeader
        title="Avanslar"
        description="Naqd pulda berilgan avanslar roʻyxati"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Avans berish
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <div className="grid gap-1.5">
            <Label>Davr</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={mode}
                onValueChange={(v) =>
                  v === 'month'
                    ? update({ from: null, to: null })
                    : update({ from: `${monthKey(ym)}-01`, to: null, month: null })
                }
              >
                <SelectTrigger className="w-40" aria-label="Davr turi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Oy boʻyicha</SelectItem>
                  <SelectItem value="range">Sana oraligʻi</SelectItem>
                </SelectContent>
              </Select>
              {mode === 'month' ? (
                <MonthPicker value={ym} onChange={(v) => update({ month: monthKey(v) })} />
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    className="w-40"
                    aria-label="Boshlanish sanasi"
                    value={from}
                    onChange={(e) => update({ from: e.target.value })}
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="date"
                    className="w-40"
                    aria-label="Tugash sanasi"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => update({ to: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="adv-employee">Xodim</Label>
              <EmployeeSelect
                id="adv-employee"
                includeAll
                value={employeeId}
                onChange={(v) => update({ employeeId: v ? String(v) : null })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="adv-search">Qidirish</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="adv-search"
                  type="search"
                  className="pl-9"
                  placeholder="Ism yoki izoh"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="adv-sort">Saralash</Label>
              <Select value={sort} onValueChange={(v) => update({ sort: v })}>
                <SelectTrigger id="adv-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Sana (yangi)</SelectItem>
                  <SelectItem value="date_asc">Sana (eski)</SelectItem>
                  <SelectItem value="amount_desc">Summa (katta)</SelectItem>
                  <SelectItem value="amount_asc">Summa (kichik)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => {
              setSearch('');
              update({ employeeId: null, q: null });
            }}
          >
            <X /> Filtrlarni tozalash
          </Button>
        )}
      </Card>

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-accent/60 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          {periodLabel} · {q.data?.total ?? 0} ta avans
        </span>
        <span className="tabular text-lg font-semibold" data-testid="advances-total">
          Jami: {formatMoney(q.data?.totalAmount ?? 0)}
        </span>
      </div>

      <Card>
        {q.isLoading ? (
          <TableSkeleton cols={4} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <EmptyState
            icon={<HandCoins className="h-6 w-6" />}
            title="Avanslar topilmadi"
            description="Tanlangan davr va filtrlar boʻyicha avans yoʻq."
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead>Xodim</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead>Izoh</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.items.map((a) => (
                    <TableRow key={a.id} data-testid="advance-row">
                      <TableCell className="whitespace-nowrap">{formatDate(a.date)}</TableCell>
                      <TableCell>
                        <Link to={`/employees/${a.employee.id}`} className="font-medium hover:underline">
                          {a.employee.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right font-medium">
                        {formatMoney(a.amount)}
                      </TableCell>
                      <TableCell className="max-w-[18rem] truncate text-muted-foreground">
                        {a.note ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Avansni tahrirlash"
                          onClick={() => {
                            setEditing(a);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Avansni oʻchirish"
                          onClick={() => setDeleting(a)}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y md:hidden">
              {q.data.items.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-4 py-3" data-testid="advance-card">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.employee.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(a.date)}
                      {a.note ? ` · ${a.note}` : ''}
                    </p>
                    <p className="tabular text-sm font-semibold">{formatMoney(a.amount)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Avansni tahrirlash"
                    onClick={() => {
                      setEditing(a);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Avansni oʻchirish"
                    onClick={() => setDeleting(a)}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
            <Pagination
              page={q.data.page}
              pageSize={q.data.pageSize}
              total={q.data.total}
              onPageChange={(p) => update({ page: String(p) }, false)}
            />
          </>
        )}
      </Card>

      <AdvanceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        advance={editing}
        defaultEmployeeId={employeeId ?? undefined}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Avansni oʻchirish"
        description={
          deleting &&
          `${deleting.employee.fullName}ga ${formatDate(deleting.date)} sanada berilgan ${formatMoney(deleting.amount)} avans butunlay oʻchiriladi. Bu amalni qaytarib boʻlmaydi.`
        }
        confirmLabel="Oʻchirish"
        destructive
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </div>
  );
}
