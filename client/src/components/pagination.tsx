import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav
      className="no-print flex items-center justify-between gap-2 border-t px-4 py-3 text-sm"
      aria-label="Sahifalash"
    >
      <span className="text-muted-foreground">
        {from}–{to} / {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Oldingi sahifa"
        >
          <ChevronLeft />
        </Button>
        <span className="tabular">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Keyingi sahifa"
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
