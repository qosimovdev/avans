import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Pencil, Search, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EmployeeFormDialog } from '@/components/employee-form-dialog';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Employee, EmployeeDetail, Paginated } from '@/lib/types';

const SORTS = [
  { value: 'name_asc', label: 'Ism (A–Z)' },
  { value: 'name_desc', label: 'Ism (Z–A)' },
  { value: 'salary_desc', label: 'Maosh (kamayish)' },
  { value: 'salary_asc', label: 'Maosh (oʻsish)' },
  { value: 'start_desc', label: 'Ish boshlash (yangi)' },
  { value: 'start_asc', label: 'Ish boshlash (eski)' },
  { value: 'created_desc', label: 'Qoʻshilgan (yangi)' },
];

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function EmployeesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get('status') ?? 'all';
  const sort = params.get('sort') ?? 'name_asc';
  const page = Number(params.get('page') ?? 1) || 1;
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debounced = useDebounced(search.trim());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeDetail | null>(null);

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced) update({ q: debounced || null, page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const q = useQuery({
    queryKey: ['employees', { status, sort, page, search: debounced }],
    queryFn: () =>
      api.get<Paginated<Employee>>('/employees', { status, sort, page, pageSize: 20, search: debounced }),
    placeholderData: (prev) => prev,
  });

  const openEdit = async (id: number) => {
    const detail = await api.get<EmployeeDetail>(`/employees/${id}`);
    setEditing(detail);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Xodimlar"
        description="Xodimlar roʻyxati, oylik maoshlari va holati"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <UserPlus /> Xodim qoʻshish
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Ism yoki telefon boʻyicha qidirish"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Qidirish"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex">
            <Select
              value={status}
              onValueChange={(v) => update({ status: v === 'all' ? null : v, page: null })}
            >
              <SelectTrigger className="md:w-36" aria-label="Holat boʻyicha filtr">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                <SelectItem value="active">Faol</SelectItem>
                <SelectItem value="inactive">Nofaol</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => update({ sort: v, page: null })}>
              <SelectTrigger className="md:w-48" aria-label="Saralash">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {q.isLoading ? (
          <TableSkeleton cols={5} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={debounced || status !== 'all' ? 'Hech narsa topilmadi' : 'Hali xodim qoʻshilmagan'}
            description={
              debounced || status !== 'all'
                ? 'Qidiruv yoki filtrlarni oʻzgartirib koʻring.'
                : 'Birinchi xodimni qoʻshing.'
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Xodim</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-right">Oylik maosh</TableHead>
                    <TableHead>Ish boshlagan</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.items.map((e) => (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/employees/${e.id}`)}
                      data-testid="employee-row"
                    >
                      <TableCell>
                        <Link
                          to={`/employees/${e.id}`}
                          className="font-medium hover:underline"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {e.fullName}
                        </Link>
                        {e.position && <p className="text-xs text-muted-foreground">{e.position}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {e.phone ?? '—'}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right font-medium">
                        {formatMoney(e.currentSalary)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(e.employmentStartDate)}</TableCell>
                      <TableCell>
                        <Badge variant={e.isActive ? 'success' : 'muted'}>
                          {e.isActive ? 'Faol' : 'Nofaol'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`${e.fullName} — tahrirlash`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openEdit(e.id);
                          }}
                        >
                          <Pencil />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y md:hidden">
              {q.data.items.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/employees/${e.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-secondary"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{e.fullName}</p>
                        <Badge variant={e.isActive ? 'success' : 'muted'}>
                          {e.isActive ? 'Faol' : 'Nofaol'}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {[e.position, e.phone].filter(Boolean).join(' · ') || '—'}
                      </p>
                      <p className="tabular mt-0.5 text-sm font-semibold">{formatMoney(e.currentSalary)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              page={q.data.page}
              pageSize={q.data.pageSize}
              total={q.data.total}
              onPageChange={(p) => update({ page: String(p) })}
            />
          </>
        )}
      </Card>

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editing}
        onSaved={(e) => {
          if (!editing) navigate(`/employees/${e.id}`);
        }}
      />
    </div>
  );
}
