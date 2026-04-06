import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import MasterRecords from './pages/MasterRecords';
import Chemists from './pages/Chemists';
import ProtectedRoute from './components/ProtectedRoute';
import Profile from './pages/Profile';
import DCR from './pages/DCR';
import LMS from './pages/LMS';
import Bill from './pages/Bill';
import BillsList from './pages/BillsList';
import PublicBillView from './pages/PublicBillView';
import StockManagement from './pages/StockManagement';

function AppRoutes() {
  const { userRole, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/receipt/:id" element={<PublicBillView />} />

      <Route path="/super-admin" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <SuperAdminDashboard />
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      <Route path="/bills" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <BillsList />
        </ProtectedRoute>
      } />
      <Route path="/stock" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <StockManagement />
        </ProtectedRoute>
      } />

      <Route path="/bill/create" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Bill />
        </ProtectedRoute>
      } />

      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['user']}>
          <UserDashboard />
        </ProtectedRoute>
      } />

      <Route path="/profile" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/dcr" element={
        <ProtectedRoute allowedRoles={['admin', 'user']}>
          <DCR />
        </ProtectedRoute>
      } />

      <Route path="/master" element={
        <ProtectedRoute allowedRoles={['admin', 'user']}>
          <MasterRecords />
        </ProtectedRoute>
      } />

      <Route path="/chemists" element={
        <ProtectedRoute allowedRoles={['admin', 'user']}>
          <Chemists />
        </ProtectedRoute>
      } />

      <Route path="/lms" element={
        <ProtectedRoute allowedRoles={['admin', 'user']}>
          <LMS />
        </ProtectedRoute>
      } />

      <Route path="/" element={
        userRole === 'super_admin' ? <Navigate to="/super-admin" /> :
          userRole === 'admin' ? <Navigate to="/admin" /> :
            userRole === 'user' ? <Navigate to="/dashboard" /> :
              <Navigate to="/login" />
      } />
    </Routes>
  );
}

function App() {
  // Use '/' on native and local dev, "/mr" on GitHub Pages web
  const basename = Capacitor.isNativePlatform() || import.meta.env.DEV ? '/' : '/mr';
  return (
    <Router basename={basename}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
