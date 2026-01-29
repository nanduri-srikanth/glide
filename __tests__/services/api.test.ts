/**
 * Unit tests for API service
 *
 * These tests verify the API service behavior including HTTP methods,
 * error handling, and token refresh logic.
 */

// Mock dependencies
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((options) => options.ios || options.default),
  },
}));

import * as SecureStore from 'expo-secure-store';
import api from '../../services/api';

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('ApiService', () => {
  describe('token management', () => {
    it('should report authentication status correctly after setting tokens', async () => {
      // Initially not authenticated
      expect(api.isAuthenticated()).toBe(false);

      // After saving tokens, should be authenticated
      await api.saveTokens('access', 'refresh');
      expect(api.isAuthenticated()).toBe(true);

      // After clearing, should not be authenticated
      await api.clearTokens();
      expect(api.isAuthenticated()).toBe(false);
    });

    it('should return access token after saving', async () => {
      await api.saveTokens('my-token', 'my-refresh');
      expect(api.getAccessToken()).toBe('my-token');
    });
  });

  describe('HTTP methods', () => {
    beforeEach(async () => {
      await api.ensureTokensLoaded();
    });

    it('should make GET requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ data: 'test' })),
      });

      const result = await api.get('/test');

      expect(result.data).toEqual({ data: 'test' });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should make POST requests with JSON body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ created: true })),
      });

      const result = await api.post('/create', { name: 'test' });

      expect(result.data).toEqual({ created: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/create'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      );
    });

    it('should make PATCH requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ updated: true })),
      });

      const result = await api.patch('/update/1', { name: 'updated' });

      expect(result.data).toEqual({ updated: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/update/1'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should make DELETE requests', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      });

      const result = await api.delete('/delete/1');

      expect(result.data).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/delete/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should include authorization header when authenticated', async () => {
      await api.saveTokens('my-token', 'refresh');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({})),
      });

      await api.get('/protected');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await api.ensureTokensLoaded();
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ detail: 'Resource not found' }),
      });

      const result = await api.get('/not-found');

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(404);
      expect(result.error?.message).toBe('Resource not found');
    });

    it('should handle Pydantic validation errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: () => Promise.resolve({
          detail: [
            { loc: ['body', 'email'], msg: 'Invalid email format', type: 'value_error' },
          ],
        }),
      });

      const result = await api.post('/register', { email: 'invalid' });

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(422);
      expect(result.error?.message).toBe('Invalid email format');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      const result = await api.get('/test');

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(0);
      expect(result.error?.message).toBe('Network failure');
    });

    it('should handle JSON parse errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await api.get('/test');

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(500);
    });
  });

  describe('token refresh', () => {
    beforeEach(async () => {
      await api.ensureTokensLoaded();
    });

    it('should refresh token on 401 and retry request', async () => {
      await api.saveTokens('expired-token', 'valid-refresh');

      // First call returns 401
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Token expired' }),
        })
        // Refresh call succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'new-access',
            refresh_token: 'new-refresh',
          }),
        })
        // Retry succeeds
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ data: 'success' })),
        });

      const result = await api.get('/protected');

      expect(result.data).toEqual({ data: 'success' });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should clear tokens if refresh fails', async () => {
      await api.saveTokens('expired-token', 'invalid-refresh');

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Token expired' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Invalid refresh token' }),
        });

      await api.get('/protected');

      expect(api.isAuthenticated()).toBe(false);
    });
  });

  describe('postFormData', () => {
    beforeEach(async () => {
      await api.ensureTokensLoaded();
    });

    it('should send FormData without Content-Type header', async () => {
      await api.saveTokens('token', 'refresh');

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uploaded: true }),
      });

      const formData = new FormData();
      formData.append('file', 'test-content');

      const result = await api.postFormData('/upload', formData);

      expect(result.data).toEqual({ uploaded: true });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({
          method: 'POST',
          body: formData,
        })
      );
    });
  });
});
