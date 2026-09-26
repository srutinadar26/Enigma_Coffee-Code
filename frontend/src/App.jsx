import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { CaseProvider } from './context/CaseContext';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import CaseSetup from './pages/CaseSetup';
import Dashboard from './pages/Dashboard';
import Vault from './pages/Vault';
import Documents from './pages/Documents';
import Loans from './pages/Loans';
import Claims from './pages/Claims';
import Nominees from './pages/Nominees';
import Reminders from './pages/Reminders';
import Family from './pages/Family';
import AIAssistant from './pages/AIAssistant';
import AuditLog from './pages/AuditLog';

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />

      <Route
        element={
          <RequireAuth>
            <CaseProvider>
              <Layout />
            </CaseProvider>
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/claims" element={<Claims />} />
        <Route path="/nominees" element={<Nominees />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/family" element={<Family />} />
        <Route path="/assistant" element={<AIAssistant />} />
        <Route path="/audit" element={<AuditLog />} />
      </Route>

      <Route
        path="/cases/new"
        element={
          <RequireAuth>
            <CaseProvider>
              <CaseSetup />
            </CaseProvider>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
