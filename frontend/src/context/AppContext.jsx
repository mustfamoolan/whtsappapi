import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('wasla_token') || '');
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('wasla_user') || 'null');
    } catch {
      return null;
    }
  });
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectIdState] = useState(() => {
    const saved = localStorage.getItem('wasla_selected_project_id');
    return saved ? Number(saved) : null;
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('wasla_token');
    localStorage.removeItem('wasla_user');
    localStorage.removeItem('wasla_selected_project_id');
    setToken('');
    setUser(null);
    setProjects([]);
    setSelectedProjectIdState(null);
  }, []);

  const setSelectedProjectId = useCallback((id) => {
    setSelectedProjectIdState(id);
    if (id) {
      localStorage.setItem('wasla_selected_project_id', String(id));
    } else {
      localStorage.removeItem('wasla_selected_project_id');
    }
  }, []);

  const apiFetch = useCallback(
    (path, options = {}) => apiRequest(path, options, logout),
    [logout]
  );

  const fetchProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch('/projects');
      if (res.ok) {
        const data = await res.json();
        const list = data.data || data.projects || [];
        setProjects(list);
        if (list.length > 0) {
          const exists = list.some((p) => p.id === selectedProjectId);
          if (!selectedProjectId || !exists) {
            setSelectedProjectId(list[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, [token, apiFetch, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (token) {
      fetchProjects();
    }
  }, [token, fetchProjects]);

  const saveSession = useCallback((newToken, newUser) => {
    localStorage.setItem('wasla_token', newToken);
    localStorage.setItem('wasla_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || projects[0] || null;

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        projects,
        setProjects,
        selectedProject,
        selectedProjectId,
        setSelectedProjectId,
        globalSearch,
        setGlobalSearch,
        showNewModal,
        setShowNewModal,
        toast,
        showToast,
        apiFetch,
        fetchProjects,
        saveSession,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

