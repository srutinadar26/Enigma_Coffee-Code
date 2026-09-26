import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { useAuth } from './AuthContext';

const CaseContext = createContext(null);

export function CaseProvider({ children }) {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [activeCase, setActiveCase] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshCases = useCallback(async () => {
    if (!user) { setCases([]); setActiveCase(null); setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await client.get('/cases');
      setCases(data.cases);
      setActiveCase((prev) => {
        if (prev && data.cases.find((c) => c.id === prev.id)) return prev;
        const savedId = localStorage.getItem('estate_active_case');
        return data.cases.find((c) => c.id === savedId) || data.cases[0] || null;
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refreshCases(); }, [refreshCases]);

  const selectCase = useCallback((c) => {
    setActiveCase(c);
    if (c) localStorage.setItem('estate_active_case', c.id);
  }, []);

  return (
    <CaseContext.Provider value={{ cases, activeCase, selectCase, refreshCases, loading }}>
      {children}
    </CaseContext.Provider>
  );
}

export function useCase() {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error('useCase must be used within CaseProvider');
  return ctx;
}
