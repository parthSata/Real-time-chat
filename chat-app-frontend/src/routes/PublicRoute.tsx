// src/components/PublicRoute.tsx
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface PublicRouteProps {
    children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
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

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

export default PublicRoute;