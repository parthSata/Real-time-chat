import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, Search, Plus, LogOut } from 'lucide-react';
import AnimatedPage from '../components/AnimatedPage';
import ChatList from '../components/ChatList';
import Sidebar from '../components/Sidebar';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../context/AuthContext';

// Define User interface based on backend response
// interface User {
//   id: string;
//   username: string;
//   email?: string;
//   profilePic?: string;
//   status?: string;
//   isOnline?: boolean;
// }

// Define Chat interface based on backend response
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
  const { user, isAuthenticated, loading, logout } = useAuth();
  const navigate = useNavigate();

  // Fetch chats on mount
  useEffect(() => {
    if (!loading && isAuthenticated) {
      fetchChats();
    }
  }, [loading, isAuthenticated]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  // Filter chats or handle user search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(chats);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = chats.filter((chat) => {
        const otherParticipant = chat.participants.find(
          (p) => p._id !== user?.id
        );
        return (
          otherParticipant?.username.toLowerCase().includes(query) ||
          (chat.lastMessage && chat.lastMessage.toLowerCase().includes(query))
        );
      });
      setFilteredChats(filtered);
    }
  }, [searchQuery, chats, user]);

  // Fetch chats from backend
  const fetchChats = async (): Promise<void> => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/chats/my-chats', {
        method: 'GET',
        credentials: 'include',
      });
      const data: { success: boolean; data: Chat[]; message?: string } = await response.json();
      if (data.success) {
        setChats(data.data);
        setFilteredChats(data.data);
      } else {
        console.error('Failed to fetch chats:', data.message);
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  // Create a new chat
  const handleCreateChat = async (username?: string): Promise<void> => {
    try {
      const targetUsername = username || searchQuery.trim();
      if (!targetUsername) {
        alert('Please enter a username to start a chat');
        return;
      }
      const response = await fetch('http://localhost:3000/api/v1/chats/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: targetUsername }),
      });
      const data: { success: boolean; data: Chat; message?: string } = await response.json();
      if (data.success) {
        setChats((prev) => [data.data, ...prev]);
        setSearchQuery('');
        navigate(`/chat/${data.data._id}`);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error creating chat:', err);
    }
  };

  // Handle logout
  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111827]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="text-white"
        >
          Loading...
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-card dark:bg-background flex flex-col md:flex-row">
        {/* Sidebar */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main content */}
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
            {user && (
              <div className="mb-4 text-white">
                Welcome, {user.username}!
              </div>
            )}
            {filteredChats.length > 0 ? (
              <ChatList chats={filteredChats} />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-10"
              >
                <p className="text-muted-foreground dark:text-gray-400">
                  {searchQuery.trim()
                    ? 'No matching conversations found'
                    : 'No conversations yet'}
                </p>
                {searchQuery.trim() && (
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