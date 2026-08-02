import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import api, {
  setAccessToken,
  clearAccessToken,
  setRefreshToken,
  clearRefreshToken,
  getRefreshToken
} from '@/services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  companyId?: number;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithResponse: (accessToken: string, refreshToken: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const initAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const refreshToken = getRefreshToken();

      if (storedUser && refreshToken) {
        // Restore user from localStorage immediately — don't block on token refresh
        setUser(JSON.parse(storedUser));
        setLoading(false);

        // Refresh the access token in the background (non-blocking)
        api.post('/auth/refresh', { refreshToken }, { timeout: 8000 })
          .then(response => {
            setAccessToken(response.data.accessToken);
            console.log('✅ Token refreshed successfully on page load');
          })
          .catch((error: any) => {
            console.error('❌ Failed to refresh token on load:', error.response?.status, error.message);
            if (error.response?.status === 401 || error.response?.status === 403) {
              console.log('🔒 Refresh token invalid, clearing auth data');
              clearAccessToken();
              clearRefreshToken();
              localStorage.removeItem('user');
              setUser(null);
            } else {
              console.log('⚠️ Network/timeout error on refresh, keeping user logged in');
            }
          });
        return; // loading already set to false above
      } else {
        // Clear everything if incomplete
        clearAccessToken();
        clearRefreshToken();
        localStorage.removeItem('user');
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user: userData } = response.data;

      // Store access token in memory
      setAccessToken(accessToken);

      // Store refresh token in localStorage
      setRefreshToken(refreshToken);

      // Store user data in localStorage
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);

      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const loginWithResponse = async (accessToken: string, refreshToken: string, userData: User): Promise<void> => {
    setAccessToken(accessToken);
    setRefreshToken(refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        // Call logout endpoint to invalidate refresh token
        await api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear everything regardless of API call result
      setUser(null);
      clearAccessToken();
      clearRefreshToken();
      localStorage.removeItem('user');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithResponse,
        logout,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
