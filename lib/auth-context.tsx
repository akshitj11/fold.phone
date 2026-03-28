export { useAuth, useAuthStore } from './store/auth-store';
import React from 'react';
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
