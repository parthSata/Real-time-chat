// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, Search, Plus, LogOut } from 'lucide-react';
import io from 'socket.io-client';
import AnimatedPage from '../components/AnimatedPage';
import ChatList from '../components/ChatList';
import Sidebar from '../components/Sidebar';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'http://localhost:3000';

interface User {
  id: string;
  username: string;
  email?: string;
  profilePic?: string;
  status?: string;
  isOnline?: boolean;
}

interface Chat {
  _id: string;
  participants: { _id: string; username: string }[];
  lastMessage?: string;
  updatedAt: string;
  unread?: number;
}

const Dashboard: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [error, setError] = useState<string>('');
  const { user, isAuthenticated, loading, logout } = useAuth();
  const navigate = useNavigate();

  const currentUser: User | null = user;

  useEffect(() => {
    if (!loading && isAuthenticated) {
      fetchChats();
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(chats);
      setSearchedUser(null);
      setError('');
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = chats.filter((chat) => {
        const otherParticipant = chat.participants.find((p) => p._id !== currentUser?.id);
        return (
          otherParticipant?.username.toLowerCase().includes(query) ||
          (chat.lastMessage && chat.lastMessage.toLowerCase().includes(query))
        );
      });
      setFilteredChats(filtered);
      searchUser(query);
    }
  }, [searchQuery, chats, currentUser]);

  useEffect(() => {
    const newSocket = io(API_BASE_URL, { withCredentials: true });

    if (user) {
      newSocket.emit('join', user.id);
    }

    newSocket.on('newChat', (chat: Chat) => {
      console.log('Received new chat:', chat);
      setChats((prev) => {
        // Prevent duplicates by checking if the chat already exists
        if (prev.some((existingChat) => existingChat._id === chat._id)) {
          return prev;
        }
        return [chat, ...prev];
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const fetchChats = async (): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chats/my-chats`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data: { success: boolean; data: Chat[]; message?: string } = await response.json();
      if (data.success) {
        // Remove duplicates from the fetched chats
        const uniqueChats = Array.from(
          new Map(data.data.map((chat) => [chat._id, chat])).values()
        );
        setChats(uniqueChats);
        setFilteredChats(uniqueChats);
      } else {
        console.error('Failed to fetch chats:', data.message);
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  const searchUser = async (username: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/search?username=${username}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }

      const data: { success: boolean; data: User; message?: string } = await response.json();
      if (data.success) {
        setSearchedUser(data.data);
        setError('');
      } else {
        setSearchedUser(null);
        setError(data.message || 'User not found');
      }
    } catch (err: any) {
      console.error('Search user error:', err.message);
      setSearchedUser(null);
      setError(err.message || 'User not found');
    }
  };

  const handleCreateChat = async (username?: string): Promise<void> => {
    try {
      const targetUsername = username || searchQuery.trim();
      if (!targetUsername) {
        alert('Please enter a username to start a chat');
        return;
      }

      const existingChat = chats.find((chat) => {
        const otherParticipant = chat.participants.find((p) => p._id !== currentUser?.id);
        return otherParticipant?.username.toLowerCase() === targetUsername.toLowerCase();
      });

      if (existingChat) {
        navigate(`/chat/${existingChat._id}`);
        setSearchQuery('');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/chats/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: targetUsername }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }
      const data: { success: boolean; data: Chat; message?: string } = await response.json();
      if (data.success) {
        // Prevent duplicates when adding the new chat
        setChats((prev) => {
          if (prev.some((chat) => chat._id === data.data._id)) {
            return prev;
          }
          return [data.data, ...prev];
        });
        setSearchQuery('');
        navigate(`/chat/${data.data._id}`);
      } else {
        alert(data.message || 'Failed to create chat');
      }
    } catch (err: any) {
      console.error('Error creating chat:', err);
      alert('Failed to create chat: ' + err.message);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-card dark:bg-background flex flex-col md:flex-row">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 bg-[#111827]">
          <header className="bg-card dark:bg-gray-800 shadow-sm sticky top-0 z-10">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="md:hidden p-2 rounded-md text-foreground dark:text-white hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Menu size={24} />
                </button>
                <h1 className="ml-2 md:ml-0 text-xl font-semibold text-foreground dark:text-white">
                  Messages
                </h1>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCreateChat()}
                  className="p-2 rounded-full bg-[#0284c7] text-primary-foreground shadow-md"
                  title="Create New Chat"
                >
                  <Plus size={20} className="text-white" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="p-2 rounded-full bg-red-500 text-white shadow-md"
                  title="Logout"
                >
                  <LogOut size={20} />
                </motion.button>
              </div>
            </div>
            <div className="px-4 py-2 border-b border-border dark:border-gray-700">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-muted-foreground dark:text-gray-400" />
                </div>
                <Input
                  type="text"
                  placeholder="Search conversations or users..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white placeholder:text-[#111827] text-[#111827] border border-input dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  fullWidth
                />
              </div>
            </div>
          </header>
          <main className="p-4 flex-1">
            {currentUser && <div className="mb-4 text-white">Welcome, {currentUser.username}!</div>}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm"
              >
                {error}
              </motion.div>
            )}
            {filteredChats.length > 0 ? (
              <ChatList chats={filteredChats} />
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
                <p className="text-muted-foreground dark:text-gray-400">
                  {searchQuery.trim() ? 'No matching conversations found' : 'No conversations yet'}
                </p>
                {searchQuery.trim() && searchedUser && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4"
                    onClick={() => handleCreateChat(searchQuery)}
                  >
                    Start a new chat with {searchQuery}
                  </Button>
                )}
              </motion.div>
            )}
          </main>
        </div>
      </div>
    </AnimatedPage>
  );
};

export default Dashboard;