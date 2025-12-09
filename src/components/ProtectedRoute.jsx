import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
    const { currentUser, userRole, loading } = useAuth();

    if (loading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // Redirect based on role if they try to access unauthorized page
        if (userRole === 'super_admin') return <Navigate to="/super-admin" />;
        if (userRole === 'admin') return <Navigate to="/admin" />;
        if (userRole === 'user') return <Navigate to="/dashboard" />;
        return <Navigate to="/login" />;
    }

    return children;
}
