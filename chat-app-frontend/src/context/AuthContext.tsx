// src/context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import axios, { AxiosError, AxiosResponse } from "axios";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean; // Added loading state
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, profilePic?: File) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true); // Start as true until session is checked

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("chatUser");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser) as User;
      setUser(parsedUser);
      setIsAuthenticated(true);
    }
    setLoading(false); // Session check complete
  }, []);

  const register = async (name: string, email: string, password: string, profilePic?: File) => {
    try {
      const formData = new FormData();
      formData.append("username", name);
      formData.append("email", email);
      formData.append("password", password);
      if (profilePic) {
        formData.append("profilePic", profilePic);
      }

      const response: AxiosResponse = await axios.post(
        "http://localhost:3000/api/v1/users/register",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        }
      );

      console.log("Register API response:", response.data);

      if (response.status >= 200 && response.status < 300) {
        const backendUser = response.data.user;
        if (!backendUser) {
          throw new Error("No user data returned from server");
        }

        const authUser: User = {
          id: backendUser.id,
          name: backendUser.username,
          email: backendUser.email,
          avatar: backendUser.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        };

        setUser(authUser);
        setIsAuthenticated(true);
        localStorage.setItem("chatUser", JSON.stringify(authUser));
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      const err = error as AxiosError<any>;
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to register user";
      throw new Error(errorMessage);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response: AxiosResponse = await axios.post(
        "http://localhost:3000/api/v1/users/login",
        { email, password },
        { withCredentials: true }
      );

      console.log("Login API response:", response.data);

      if (response.status >= 200 && response.status < 300) {
        const backendUser = response.data.user;
        if (!backendUser) {
          throw new Error("No user data returned from server");
        }

        const authUser: User = {
          id: backendUser.id,
          name: backendUser.username,
          email: backendUser.email,
          avatar: backendUser.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        };

        setUser(authUser);
        setIsAuthenticated(true);
        localStorage.setItem("chatUser", JSON.stringify(authUser));
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      const err = error as AxiosError<any>;
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to login user";
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      const response: AxiosResponse = await axios.post(
        "http://localhost:3000/api/v1/users/logout",
        {},
        { withCredentials: true }
      );

      if (response.status >= 200 && response.status < 300) {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem("chatUser");
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      const err = error as AxiosError<any>;
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to logout user";
      throw new Error(errorMessage);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    loading, // Expose loading state
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};