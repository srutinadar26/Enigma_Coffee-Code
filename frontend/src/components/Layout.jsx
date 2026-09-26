import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useCase } from '../context/CaseContext';

export default function Layout() {
  const { activeCase, cases, loading } = useCase();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-sm text-black/40">Loading…</div>;
  }

  if (cases.length === 0) {
    return <Navigate to="/cases/new" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          {activeCase ? <Outlet /> : <div className="text-sm text-black/50">Select a case to continue.</div>}
        </div>
      </main>
    </div>
  );
}
