import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Unauthorized from './Unauthorized';
import PageLoader from './PageLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireStaff?: boolean;
}

export default function ProtectedRoute({ children, requireStaff = true }: ProtectedRouteProps) {
  const { user, loading, isAuthReady, isStaff } = useAuth();

  if (loading || !isAuthReady) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/public-booking-form" replace />;
  }

  if (requireStaff && !isStaff) {
    return <Unauthorized />;
  }

  return <>{children}</>;
}
