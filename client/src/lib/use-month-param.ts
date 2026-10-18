import { useSearchParams } from 'react-router-dom';
import { currentYearMonth, monthKey, parseMonthKey, type YearMonth } from './format';

/** Selected month stored in the URL (?month=YYYY-MM) so it survives refresh and is shareable. */
export function useMonthParam(): [YearMonth, (v: YearMonth) => void] {
  const [params, setParams] = useSearchParams();
  const value = parseMonthKey(params.get('month')) ?? currentYearMonth();
  const set = (v: YearMonth) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('month', monthKey(v));
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  };
  return [value, set];
}
