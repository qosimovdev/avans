import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Banknote, HandCoins, PiggyBank, Plus, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdvanceFormDialog } from '@/components/advance-form-dialog';
import { EmployeeFormDialog } from '@/components/employee-form-dialog';
import { MonthPicker } from '@/components/month-picker';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import {
  formatDate,
  formatMoney,
  formatMoneyShort,
  formatPercent,
  monthKey,
  monthLabel,
  monthShortLabel,
} from '@/lib/format';
import type { DashboardStats } from '@/lib/types';
import { useMonthParam } from '@/lib/use-month-param';

export default function DashboardPage() {
  const [ym, setYm] = useMonthParam();
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const q = useQuery({
    queryKey: ['dashboard', ym.year, ym.month],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats', { year: ym.year, month: ym.month }),
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const loading = q.isLoading;

  return (
    <div>
      <PageHeader
        title="Bosh sahifa"
        description={`${monthLabel(ym)} holati boʻyicha umumiy koʻrsatkichlar`}
        actions={
          <>
            <MonthPicker value={ym} onChange={setYm} />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Button onClick={() => setEmployeeOpen(true)}>
          <UserPlus /> Xodim qoʻshish
        </Button>
        <Button variant="outline" onClick={() => setAdvanceOpen(true)}>
          <Plus /> Avans berish
        </Button>
      </div>

      {q.isError && !d ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Jami faol xodimlar"
              value={d?.cards.activeEmployees ?? 0}
              icon={<Users />}
              loading={loading}
              testId="stat-active"
            />
            <StatCard
              label="Oylik maoshlar jami"
              value={formatMoney(d?.cards.totalSalary ?? 0)}
              icon={<Banknote />}
              loading={loading}
              hint="Faol xodimlar boʻyicha"
              testId="stat-salary"
            />
            <StatCard
              label="Shu oy berilgan avanslar"
              value={formatMoney(d?.cards.totalAdvances ?? 0)}
              icon={<HandCoins />}
              loading={loading}
              testId="stat-advances"
            />
            <StatCard
              label="Toʻlanishi qolgan ish haqi"
              value={formatMoney(d?.cards.totalRemaining ?? 0)}
              icon={<PiggyBank />}
              loading={loading}
              tone={(d?.cards.totalRemaining ?? 0) < 0 ? 'negative' : 'default'}
              testId="stat-remaining"
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Maosh va avanslar dinamikasi</CardTitle>
                <CardDescription>Soʻnggi 6 oy</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-72 w-full" />
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={d?.chart ?? []} margin={{ left: 0, right: 8, top: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey="month" tickFormatter={monthShortLabel} tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 12 }} width={64} />
                        <Tooltip
                          formatter={(v: number) => formatMoney(v)}
                          labelFormatter={(l: string) => monthLabel(l)}
                        />
                        <Legend />
                        <Bar
                          isAnimationActive={false}
                          dataKey="totalSalary"
                          name="Maoshlar"
                          fill="#c7d2fe"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          isAnimationActive={false}
                          dataKey="totalAdvances"
                          name="Avanslar"
                          fill="#4f46e5"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Eng koʻp avans olganlar</CardTitle>
                <CardDescription>{monthLabel(ym)}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                ) : d?.topAdvances.length ? (
                  <ul className="divide-y">
                    {d.topAdvances.map((t, i) => (
                      <li key={t.employeeId} className="flex items-center gap-3 py-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/employees/${t.employeeId}`}
                            className="block truncate text-sm font-medium hover:underline"
                          >
                            {t.fullName}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {t.advanceCount} ta · {formatPercent(t.advancePercentage)} maoshdan
                          </p>
                        </div>
                        <span className="tabular text-sm font-semibold">{formatMoney(t.totalAdvances)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="Bu oyda avans berilmagan" />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Soʻnggi avanslar</CardTitle>
                <CardDescription>{monthLabel(ym)}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/advances?month=${monthKey(ym)}`}>
                  Barchasi <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : d?.recentAdvances.length ? (
                <ul className="divide-y">
                  {d.recentAdvances.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link
                          to={`/employees/${a.employee.id}`}
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {a.employee.fullName}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(a.date)}
                          {a.note ? ` · ${a.note}` : ''}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-sm font-semibold">{formatMoney(a.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Avanslar yoʻq"
                  description="Bu oy uchun hali avans qayd etilmagan."
                  action={
                    <Button size="sm" onClick={() => setAdvanceOpen(true)}>
                      <Plus /> Avans berish
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <EmployeeFormDialog open={employeeOpen} onOpenChange={setEmployeeOpen} />
      <AdvanceFormDialog open={advanceOpen} onOpenChange={setAdvanceOpen} />
    </div>
  );
}
