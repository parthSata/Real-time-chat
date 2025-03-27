// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: string;
  username: string;
  email: string;
  profilePic?: string;
  status?: string;
  isOnline?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, profilePic?: File) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkSession = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/v1/users/me', {
        withCredentials: true,
      });
      if (response.data.success) {
        setUser(response.data.data.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error: any) {
      console.error('Session check failed:', error.message);
      if (error.code === 'ERR_NETWORK') {
        console.error('Cannot connect to the backend server. Please ensure the server is running on http://localhost:3000.');
      }
      if (error.response?.status === 401) {
        try {
          await axios.post('http://localhost:3000/api/v1/users/refresh-token', {}, { withCredentials: true });
          const retryResponse = await axios.get('http://localhost:3000/api/v1/users/me', {
            withCredentials: true,
          });
          if (retryResponse.data.success) {
            setUser(retryResponse.data.data.user);
            setIsAuthenticated(true);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(
        'http://localhost:3000/api/v1/users/login',
        { email, password },
        { withCredentials: true }
      );
      if (response.data.success) {
        setUser(response.data.data.user);
        setIsAuthenticated(true);
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Cannot connect to the backend server. Please ensure the server is running on http://localhost:3000.');
      }
      if (error.response?.status === 401) {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      }
      throw new Error(error.response?.data?.message || 'An error occurred during login.');
    }
  };

  const register = async (username: string, email: string, password: string, profilePic?: File) => {
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      if (profilePic) {
        formData.append('profilePic', profilePic);
      }

      console.log(`Sending registration request for email: ${email}`);
      const response = await axios.post(
        'http://localhost:3000/api/v1/users/register',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
        }
      );

      console.log('Registration response:', response.data);
      if (response.data.success) {
        setUser(response.data.data.user);
        setIsAuthenticated(true);
      } else {
        throw new Error('Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Cannot connect to the backend server. Please ensure the server is running on http://localhost:3000.');
      }
      throw new Error(error.response?.data?.message || 'Something went wrong during registration!');
    }
  };

  const logout = async () => {
    try {
      await axios.post('http://localhost:3000/api/v1/users/logout', {}, { withCredentials: true });
      setUser(null);
      setIsAuthenticated(false);
    } catch (error: any) {
      console.error('Logout failed:', error.message);
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Cannot connect to the backend server. Please ensure the server is running on http://localhost:3000.');
      }
      throw new Error(error.response?.data?.message || 'Logout failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, loading, login, register, logout, checkSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;