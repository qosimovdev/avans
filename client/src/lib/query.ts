import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

/** After any financial mutation every derived view (lists, dashboard, reports, details) is refetched. */
export function invalidateData() {
  return queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}
