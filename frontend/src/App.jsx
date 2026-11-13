import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import OverviewPage from './pages/OverviewPage';
import ProjectsPage from './pages/ProjectsPage';
import SessionPage from './pages/SessionPage';
import WebhookPage from './pages/WebhookPage';
import PlaygroundPage from './pages/PlaygroundPage';
import LogsPage from './pages/LogsPage';
import DocsPage from './pages/DocsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';

function AppRoutes() {
  const { token } = useApp();

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />}>
          <Route index element={<SessionPage />} />
          <Route path="webhook" element={<WebhookPage />} />
          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>
        <Route path="/playground" element={<PlaygroundPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/api-docs" element={<DocsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
