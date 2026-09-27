import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry auth/permission/validation problems — only transient ones.
        if (error instanceof ApiRequestError) {
          if ([400, 401, 403, 404, 409, 429].includes(error.status)) return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

/** Central query keys so invalidation never drifts from the fetcher. */
export const qk = {
  session: ['session'] as const,
  me: ['users', 'me'] as const,
  ledger: (page: number) => ['users', 'me', 'ledger', page] as const,
  tasks: ['tasks'] as const,
  videos: ['videos'] as const,
  daily: ['daily'] as const,
  referrals: ['referrals'] as const,
  withdrawals: ['withdrawals'] as const,
  paymentMethods: ['withdrawals', 'payment-methods'] as const,
  eligibility: ['withdrawals', 'eligibility'] as const,
  activity: ['content', 'activity'] as const,
  reviews: ['content', 'reviews'] as const,
  stats: ['content', 'stats'] as const,
};
