import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './components/layout';
import { useAuth } from './lib/auth';
import AdvancesPage from './pages/advances';
import DashboardPage from './pages/dashboard';
import EmployeeDetailPage from './pages/employee-detail';
import EmployeesPage from './pages/employees';
import LoginPage from './pages/login';
import NotFoundPage from './pages/not-found';
import ReportsPage from './pages/reports';
import SettingsPage from './pages/settings';

function redirectTarget(state: unknown) {
  const from = (state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('/login') ? from : '/';
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Yuklanmoqda" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

export default function App() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  return (
    <Routes>
      <Route
        path="/login"
        element={
          isLoading ? (
            <FullScreenLoader />
          ) : user ? (
            <Navigate to={redirectTarget(location.state)} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="advances" element={<AdvancesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
