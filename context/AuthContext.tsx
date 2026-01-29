/**
 * Authentication Context
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '@/services/auth';
import { notesService } from '@/services/notes';
import api from '@/services/api';

// DEV MODE: Auto-login with test credentials
// Set DEV_AUTO_LOGIN to true and provide test user credentials
const DEV_AUTO_LOGIN = true;
const DEV_TEST_EMAIL = 'devtest@glide.app';
const DEV_TEST_PASSWORD = 'devtest123';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  signInWithApple: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (api.isAuthenticated()) {
        const { user: userData } = await authService.getCurrentUser();
        if (userData) {
          setUser(userData);
          // Ensure default folders exist
          try {
            await notesService.setupDefaultFolders();
          } catch (e) {
            // Ignore - folders may already exist
          }
        }
      } else if (DEV_AUTO_LOGIN) {
        // DEV MODE: Auto-login with test credentials
        console.log('[DEV] Auto-logging in with test credentials...');
        const result = await authService.login({
          email: DEV_TEST_EMAIL,
          password: DEV_TEST_PASSWORD
        });
        if (result.success) {
          const { user: userData } = await authService.getCurrentUser();
          if (userData) {
            setUser(userData);
            console.log('[DEV] Auto-login successful:', userData.email);
            try {
              await notesService.setupDefaultFolders();
            } catch (e) {
              // Ignore - folders may already exist
            }
          }
        } else {
          console.log('[DEV] Auto-login failed:', result.error);
          console.log('[DEV] Make sure test user exists: email=' + DEV_TEST_EMAIL);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupUserDefaults = async () => {
    // Setup default folders for new users
    try {
      await notesService.setupDefaultFolders();
    } catch (error) {
      console.log('Default folders setup:', error);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await authService.login({ email, password });
    if (result.success) {
      const { user: userData } = await authService.getCurrentUser();
      if (userData) setUser(userData);
      await setupUserDefaults();
    }
    return result;
  };

  const register = async (email: string, password: string, fullName?: string) => {
    const { error } = await authService.register({ email, password, full_name: fullName });
    if (error) return { success: false, error };
    return await login(email, password);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const signInWithApple = async () => {
    const result = await authService.signInWithApple();
    if (result.success) {
      const { user: userData } = await authService.getCurrentUser();
      if (userData) setUser(userData);
      await setupUserDefaults();
    }
    return result;
  };

  const refreshUser = async () => {
    const { user: userData } = await authService.getCurrentUser();
    if (userData) setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, register, signInWithApple, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
