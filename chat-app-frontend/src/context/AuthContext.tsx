// context/AuthContext.js (or .tsx for TypeScript)
import React, { createContext, useState, useContext, useEffect, ReactNode } from "react";
import axios from "axios"; // Ensure axios is installed

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, profilePic?: File) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem("chatUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
  }, []);

  const register = async (name: string, email: string, password: string, profilePic?: File) => {
    try {
      const formData = new FormData();
      formData.append("username", name); // Map name to username for backend compatibility
      formData.append("email", email);
      formData.append("password", password);
      if (profilePic) {
        formData.append("profilePic", profilePic); // Optional profile picture upload
      }

      // Send registration request to backend
      const response = await axios.post(
        "http://localhost:3000/api/v1/users/register", // Update port if your backend runs on a different port
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data", // Required for form-data
          },
          withCredentials: true, // Include cookies (for token in cookies)
        }
      );

      // Extract user data from response and map to your User interface
      const backendUser = response.data.data.user;
      const authUser: User = {
        id: backendUser.id,
        name: backendUser.username, // Map backend username to name
        email: backendUser.email,
        avatar: backendUser.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`, // Use Cloudinary URL or fallback to avatar
      };

      setUser(authUser);
      setIsAuthenticated(true);
      localStorage.setItem("chatUser", JSON.stringify(authUser));

      return; // No need to return response.data unless needed elsewhere
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to register user"
      );
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(
        "http://localhost:3000/api/v1/users/login",
        { email, password },
        { withCredentials: true } // Include cookies
      );

      // Extract user data from response and map to your User interface
      const backendUser = response.data.data.user;
      const authUser: User = {
        id: backendUser.id,
        name: backendUser.username, // Map backend username to name
        email: backendUser.email,
        avatar: backendUser.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`, // Use Cloudinary URL or fallback
      };

      setUser(authUser);
      setIsAuthenticated(true);
      localStorage.setItem("chatUser", JSON.stringify(authUser));

      return; // No need to return response.data unless needed elsewhere
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to login user"
      );
    }
  };

  const logout = async () => {
    try {
      await axios.post(
        "http://localhost:3000/api/v1/users/logout",
        {},
        { withCredentials: true } // Include cookies
      );

      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("chatUser");
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to logout user"
      );
    }
  };

  const value = {
    user,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};