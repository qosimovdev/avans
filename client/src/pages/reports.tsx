import { useQuery } from '@tanstack/react-query';
import { Banknote, Download, FileBarChart, HandCoins, PiggyBank, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmployeeSelect } from '@/components/employee-select';
import { MonthPicker } from '@/components/month-picker';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, downloadFile, errorMessage } from '@/lib/api';
import { formatDateTime, formatMoney, formatPercent, monthKey, monthLabel } from '@/lib/format';
import type { MonthlyReport } from '@/lib/types';
import { useMonthParam } from '@/lib/use-month-param';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const [ym, setYm] = useMonthParam();
  const [params, setParams] = useSearchParams();
  const employeeId = Number(params.get('employeeId')) || null;
  const status = params.get('status') ?? 'all';
  const [exporting, setExporting] = useState(false);

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );

  const query = { year: ym.year, month: ym.month, employeeId, status };
  const q = useQuery({
    queryKey: ['reports', query],
    queryFn: () => api.get<MonthlyReport>('/reports/monthly', query),
    placeholderData: (prev) => prev,
  });
  const r = q.data;

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile('/reports/monthly.csv', query, `ish-haqqi-${monthKey(ym)}.csv`);
      toast.success('CSV fayl yuklab olindi');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Oylik hisobot"
        description={`${monthLabel(ym)} uchun maosh, avans va qolgan ish haqi`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exporting || !r?.rows.length}>
              <Download /> CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!r?.rows.length}>
              <Printer /> Chop etish
            </Button>
          </>
        }
      />

      <div className="print-only mb-4">
        <h2 className="text-xl font-semibold">IshHaqqi — {monthLabel(ym)} oylik hisobot</h2>
        <p className="text-sm">Tayyorlangan: {formatDateTime(new Date().toISOString())} (Toshkent vaqti)</p>
      </div>

      <Card className="no-print mb-4 p-4">
        <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr]">
          <div className="grid gap-1.5">
            <Label>Oy va yil</Label>
            <MonthPicker value={ym} onChange={setYm} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rep-employee">Xodim</Label>
            <EmployeeSelect
              id="rep-employee"
              includeAll
              value={employeeId}
              onChange={(v) => update({ employeeId: v ? String(v) : null })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rep-status">Holat</Label>
            <Select value={status} onValueChange={(v) => update({ status: v === 'all' ? null : v })}>
              <SelectTrigger id="rep-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha xodimlar</SelectItem>
                <SelectItem value="active">Faqat faol</SelectItem>
                <SelectItem value="inactive">Faqat nofaol</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Maoshlar jami"
          value={formatMoney(r?.totals.totalSalary ?? 0)}
          icon={<Banknote />}
          loading={q.isLoading}
          testId="report-total-salary"
        />
        <StatCard
          label="Avanslar jami"
          value={formatMoney(r?.totals.totalAdvances ?? 0)}
          icon={<HandCoins />}
          loading={q.isLoading}
          hint={r ? `${formatPercent(r.totals.advancePercentage)} maoshdan` : undefined}
          testId="report-total-advances"
        />
        <StatCard
          label="Qolgan ish haqi jami"
          value={formatMoney(r?.totals.totalRemaining ?? 0)}
          icon={<PiggyBank />}
          loading={q.isLoading}
          tone={(r?.totals.totalRemaining ?? 0) < 0 ? 'negative' : 'default'}
          testId="report-total-remaining"
        />
      </div>

      <Card className="print-plain">
        {q.isLoading ? (
          <TableSkeleton cols={5} />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !r?.rows.length ? (
          <EmptyState
            icon={<FileBarChart className="h-6 w-6" />}
            title="Bu oy uchun maʼlumot yoʻq"
            description="Tanlangan oyda maoshi belgilangan yoki avans olgan xodim topilmadi."
          />
        ) : (
          <Table data-testid="report-table">
            <TableHeader>
              <TableRow>
                <TableHead>Xodim</TableHead>
                <TableHead className="text-right">Oylik maosh</TableHead>
                <TableHead className="text-right">Avanslar jami</TableHead>
                <TableHead className="text-right">Qolgan ish haqi</TableHead>
                <TableHead className="text-right">Avans foizi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.rows.map((row) => (
                <TableRow key={row.employeeId} data-testid="report-row">
                  <TableCell>
                    <Link to={`/employees/${row.employeeId}`} className="font-medium hover:underline">
                      {row.fullName}
                    </Link>
                    <div className="flex items-center gap-2">
                      {row.position && <span className="text-xs text-muted-foreground">{row.position}</span>}
                      {!row.isActive && <Badge variant="muted">Nofaol</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-right">
                    {formatMoney(row.monthlySalary)}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-right">
                    {formatMoney(row.totalAdvances)}
                    {row.advanceCount > 0 && (
                      <span className="block text-xs text-muted-foreground">{row.advanceCount} ta</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'tabular whitespace-nowrap text-right font-semibold',
                      row.remainingSalary < 0 && 'text-destructive',
                    )}
                  >
                    {formatMoney(row.remainingSalary)}
                  </TableCell>
                  <TableCell className="tabular text-right">{formatPercent(row.advancePercentage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Jami ({r.totals.employees} xodim)</TableCell>
                <TableCell className="tabular whitespace-nowrap text-right">
                  {formatMoney(r.totals.totalSalary)}
                </TableCell>
                <TableCell className="tabular whitespace-nowrap text-right">
                  {formatMoney(r.totals.totalAdvances)}
                </TableCell>
                <TableCell
                  className={cn(
                    'tabular whitespace-nowrap text-right',
                    r.totals.totalRemaining < 0 && 'text-destructive',
                  )}
                >
                  {formatMoney(r.totals.totalRemaining)}
                </TableCell>
                <TableCell className="tabular text-right">
                  {formatPercent(r.totals.advancePercentage)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Qolgan ish haqi = oylik maosh − shu oydagi avanslar. Maosh oʻzgarsa, yangi maosh tanlangan oyning
        1-sanasidan amal qiladi.
      </p>
    </div>
  );
}
