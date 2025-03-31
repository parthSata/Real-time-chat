import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  console.log("🚀 ~ user:", user)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      const newSocket = io('http://localhost:3000', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        newSocket.emit('join', user.id); // Join user ID room
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
        setSocket(null);
      };
    } else if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [isAuthenticated, user]);

  const checkSession = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/v1/users/me', {
        withCredentials: true,
      });
      console.log('Response Data:', response.data);
      if (response.data.success && response.data.message) {
        const newUser = {
          ...response.data.message,
          id: response.data.message._id,
        };
        setUser((prevUser) => {
          if (JSON.stringify(prevUser) === JSON.stringify(newUser)) {
            return prevUser;
          }
          return newUser;
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        console.log('Session check failed: No user data in response or success is false');
      }
    } catch (error: any) {
      console.error('Session check failed:', error.message);
      if (error.code === 'ERR_NETWORK') {
        console.error('Cannot connect to the backend server. Please ensure the server is running on http://localhost:3000.');
      }
      if (error.response?.status === 401) {
        console.log('Received 401, attempting to refresh token...');
        try {
          const refreshResponse = await axios.post('http://localhost:3000/api/v1/users/refresh-token', {}, { withCredentials: true });
          console.log('Token refresh response:', refreshResponse.data);
          const retryResponse = await axios.get('http://localhost:3000/api/v1/users/me', {
            withCredentials: true,
          });
          console.log('Retry session check response:', retryResponse.data);
          if (retryResponse.data.success && retryResponse.data.message) {
            const newUser = {
              ...retryResponse.data.message,
              id: retryResponse.data.message._id,
            };
            setUser((prevUser) => {
              if (JSON.stringify(prevUser) === JSON.stringify(newUser)) {
                return prevUser;
              }
              return newUser;
            });
            setIsAuthenticated(true);
            console.log('User authenticated after token refresh:', retryResponse.data.message);
          } else {
            setUser(null);
            setIsAuthenticated(false);
            console.log('User not authenticated: No user data after token refresh');
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          setUser(null);
          setIsAuthenticated(false);
          console.log('User not authenticated: Token refresh failed');
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        console.log('User not authenticated: Other error', error.response?.data);
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
        setUser({
          ...response.data.message,
          id: response.data.message._id,
        });
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
        setUser({
          ...response.data.message,
          id: response.data.message._id,
        });
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
      value={{ user, isAuthenticated, loading, login, register, logout, checkSession, socket }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;