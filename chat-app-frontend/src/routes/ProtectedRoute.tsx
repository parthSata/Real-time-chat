// src/components/ProtectedRoute.tsx
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, loading, checkSession } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (!loading) {
            checkSession();
        }
    }, [location.pathname, checkSession, loading]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#111827]">
                <p className="text-white">Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;