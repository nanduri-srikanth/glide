/**
 * Authentication Service
 */

import api from './api';
import * as AppleAuthentication from 'expo-apple-authentication';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  timezone: string;
  auto_transcribe: boolean;
  auto_create_actions: boolean;
  created_at: string;
  google_connected: boolean;
  apple_connected: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

import { Platform } from 'react-native';

// API Configuration - matches api.ts
const getDevHost = () => {
  if (Platform.OS === 'ios') return 'localhost';
  if (Platform.OS === 'android') return '10.0.2.2';
  return 'localhost';
};

const API_BASE_URL = __DEV__
  ? `http://${getDevHost()}:8000/api/v1`
  : 'https://your-production-api.com/api/v1';

class AuthService {
  async register(data: RegisterData): Promise<{ user?: User; error?: string }> {
    const response = await api.post<User>('/auth/register', data);
    if (response.error) return { error: response.error.message };
    return { user: response.data };
  }

  async login(data: LoginData): Promise<{ success: boolean; error?: string }> {
    const formData = new URLSearchParams();
    formData.append('username', data.email);
    formData.append('password', data.password);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.detail || 'Login failed' };
      }

      const tokens: LoginResponse = await response.json();
      await api.saveTokens(tokens.access_token, tokens.refresh_token);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  async logout(): Promise<void> {
    await api.post('/auth/logout').catch(() => {});
    await api.clearTokens();
  }

  async getCurrentUser(): Promise<{ user?: User; error?: string }> {
    const response = await api.get<User>('/auth/me');
    if (response.error) return { error: response.error.message };
    return { user: response.data };
  }

  async updateProfile(data: Partial<User>): Promise<{ user?: User; error?: string }> {
    const response = await api.patch<User>('/auth/me', data);
    if (response.error) return { error: response.error.message };
    return { user: response.data };
  }

  isAuthenticated(): boolean {
    return api.isAuthenticated();
  }

  async signInWithApple(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if Apple Sign-In is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Apple Sign-In is not available on this device' };
      }

      // Request Apple Sign-In
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Send to backend for verification and token exchange
      const response = await fetch(`${API_BASE_URL}/auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity_token: credential.identityToken,
          authorization_code: credential.authorizationCode,
          user_id: credential.user,
          email: credential.email,
          full_name: credential.fullName
            ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
            : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.detail || 'Apple Sign-In failed' };
      }

      const tokens: LoginResponse = await response.json();
      await api.saveTokens(tokens.access_token, tokens.refresh_token);
      return { success: true };
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return { success: false, error: 'Sign-In was cancelled' };
      }
      return { success: false, error: error.message || 'Apple Sign-In failed' };
    }
  }
}

export const authService = new AuthService();
export default authService;
