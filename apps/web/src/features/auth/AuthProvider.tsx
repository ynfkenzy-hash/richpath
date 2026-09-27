import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from '@richpath/shared';
import { http, onUnauthorized } from '../../lib/api';
import { qk } from '../../lib/queryClient';

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<PublicUser>;
  register: (input: Omit<RegisterInput, 'acceptTerms'> & { acceptTerms: true }) => Promise<PublicUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface SessionProbe {
  authenticated: boolean;
  user?: PublicUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();

  const session = useQuery({
    queryKey: qk.session,
    queryFn: () => http.get<SessionProbe>('/auth/session'),
    staleTime: 60_000,
    retry: false,
  });

  const onAuthed = useCallback(
    (payload: AuthResponse) => {
      client.setQueryData(qk.session, { authenticated: true, user: payload.user });
      // Everything else is user-scoped: drop it so no stale data survives a
      // sign-in/out (shared browser, multiple demo accounts).
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' && q.queryKey[0] !== 'content' });
      return payload.user;
    },
    [client],
  );

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => http.post<AuthResponse>('/auth/login', input),
    onSuccess: (data) => onAuthed(data),
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => http.post<AuthResponse>('/auth/register', input),
    onSuccess: (data) => onAuthed(data),
  });

  const logoutMutation = useMutation({
    mutationFn: () => http.post<{ ok: boolean }>('/auth/logout'),
    onSuccess: () => {
      client.setQueryData(qk.session, { authenticated: false });
      client.clear();
    },
  });

  // A 401 from any request bounces the app back to the signed-out state.
  useEffect(() => {
    const eject = onUnauthorized(() => {
      client.setQueryData(qk.session, { authenticated: false });
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' && q.queryKey[0] !== 'content' });
    });
    return eject;
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.data?.authenticated ? session.data.user ?? null : null,
      isAuthenticated: Boolean(session.data?.authenticated),
      isLoading: session.isLoading,
      login: (input) => loginMutation.mutateAsync(input).then((r) => r.user),
      register: (input) =>
        registerMutation.mutateAsync(input as RegisterInput).then((r) => r.user),
      logout: () => logoutMutation.mutateAsync().then(() => undefined),
      refresh: async () => {
        const fresh = await http.get<{ user: PublicUser }>('/users/me');
        client.setQueryData(qk.session, { authenticated: true, user: fresh.user });
      },
    }),
    [session.data, session.isLoading, loginMutation, registerMutation, logoutMutation, client],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
