import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import axios from 'axios';
import io, { Socket } from 'socket.io-client';

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
  socket: Socket | null;
  updateProfile: (data: {
    username?: string;
    email?: string;
    password?: string;
    profilePic?: File;
    status?: string;
  }) => Promise<void>;
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const hasCheckedSession = useRef(false);

  const checkSession = async () => {
    if (hasCheckedSession.current) {
      console.log('Session already checked, skipping...');
      return;
    }

    try {
      const response = await axios.get('http://localhost:3000/api/v1/users/me', {
        withCredentials: true,
      });
      if (response.data.success && response.data.message) {
        const newUser = { ...response.data.message.user, id: String(response.data.message.user._id) };
        setUser(newUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error: any) {
      console.error('Session check failed:', error.message);
      if (error.response?.status === 401) {
        try {
          const refreshResponse = await axios.post(
            'http://localhost:3000/api/v1/users/refresh-token',
            {},
            { withCredentials: true }
          );
          console.log("🚀 ~ checkSession ~ refreshResponse:", refreshResponse);
          const retryResponse = await axios.get('http://localhost:3000/api/v1/users/me', {
            withCredentials: true,
          });
          if (retryResponse.data.success && retryResponse.data.message) {
            const newUser = { ...retryResponse.data.message.user, id: String(retryResponse.data.message.user._id) };
            setUser(newUser);
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setIsAuthenticated(false);
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
      hasCheckedSession.current = true;
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const newSocket = io('http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      newSocket.emit('join', user.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [isAuthenticated, user?.id]);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(
        'http://localhost:3000/api/v1/users/login',
        { email, password },
        { withCredentials: true }
      );
      if (response.data.success && response.data.message) {
        const newUser = { ...response.data.message.user, id: String(response.data.message.user._id) };
        setUser(newUser);
        setIsAuthenticated(true);
        hasCheckedSession.current = true;
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid email or password.');
      }
      throw new Error(error.response?.data?.message || 'Login error occurred.');
    }
  };

  const register = async (username: string, email: string, password: string, profilePic?: File) => {
    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('email', email);
      formData.append('password', password);
      if (profilePic) formData.append('profilePic', profilePic);

      const response = await axios.post('http://localhost:3000/api/v1/users/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });

      if (response.data.success && response.data.message) {
        const newUser = { ...response.data.message.user, id: String(response.data.message.user._id) };
        setUser(newUser);
        setIsAuthenticated(true);
        hasCheckedSession.current = true;
      } else {
        throw new Error('Registration failed');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration error occurred.');
    }
  };

  const logout = async () => {
    try {
      await axios.post('http://localhost:3000/api/v1/users/logout', {}, { withCredentials: true });
      setUser(null);
      setIsAuthenticated(false);
      hasCheckedSession.current = false;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Logout failed');
    }
  };

  const updateProfile = async (data: {
    username?: string;
    email?: string;
    password?: string;
    profilePic?: File;
    status?: string;
  }) => {
    try {
      const formData = new FormData();
      if (data.username) formData.append('username', data.username);
      if (data.email) formData.append('email', data.email);
      if (data.password) formData.append('password', data.password);
      if (data.profilePic) formData.append('profilePic', data.profilePic);
      if (data.status) formData.append('status', data.status);

      const response = await axios.put(
        'http://localhost:3000/api/v1/users/update-profile',
        formData,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      if (response.data.success && response.data.data) {
        const updatedUser = { ...response.data.data, id: String(response.data.data._id) };
        setUser(updatedUser);
      } else {
        throw new Error('Profile update failed: Invalid response structure');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Profile update failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, loading, login, register, logout, checkSession, socket, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;