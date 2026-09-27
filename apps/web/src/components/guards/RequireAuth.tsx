import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider.js';
import { Spinner } from '../ui/index.js';

/**
 * Client-side guard. It is a UX affordance only — every protected API route
 * independently verifies the session cookie server-side.
 */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

/** Keeps signed-in users off the auth page. */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/user" replace />;
  return <>{children}</>;
}
