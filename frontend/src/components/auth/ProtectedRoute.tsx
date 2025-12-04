import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

export const ProtectedRoute: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { user, setUser } = useAuthStore();
  useEffect(() => {
    if (!user && authService.isAuthenticated()) {
      const u = authService.getCurrentUser();
      if (u) setUser(u);
    }
  }, [user, setUser]);
  return authService.isAuthenticated() ? <>{children}</> : <Navigate to="/login" />;
};
