import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import MasterRecords from './pages/MasterRecords';
import ProtectedRoute from './components/ProtectedRoute';
import Profile from './pages/Profile';
import DCR from './pages/DCR';
import LMS from './pages/LMS';

function AppRoutes() {
  const { userRole, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

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
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
