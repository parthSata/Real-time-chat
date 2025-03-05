// src/components/Dashboard.tsx
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

// Mock data (replace with API call later)
const mockChats = [
  {
    id: '1',
    name: 'Sarah Johnson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    lastMessage: 'Hey, how are you doing today?',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    unread: 2,
  },
  {
    id: '2',
    name: 'Michael Chen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    lastMessage: 'Did you see the latest project update?',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    unread: 0,
  },
  {
    id: '3',
    name: 'Jessica Williams',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica',
    lastMessage: "Let's meet for coffee tomorrow!",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    unread: 1,
  },
  {
    id: '4',
    name: 'David Rodriguez',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    lastMessage: 'Thanks for your help with the presentation.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    unread: 0,
  },
  {
    id: '5',
    name: 'Emma Thompson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    lastMessage: 'I just sent you the files you requested.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    unread: 0,
  },
];

const Dashboard: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState(mockChats);
  const { user, isAuthenticated, loading, logout } = useAuth();
  const navigate = useNavigate();

  // Redirect only after loading is complete and session is invalid
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  // Filter chats based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(mockChats);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredChats(
        mockChats.filter(
          (chat) =>
            chat.name.toLowerCase().includes(query) ||
            chat.lastMessage.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Show loading state while session is being validated
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
                  className="p-2 rounded-full bg-[#0284c7] text-primary-foreground shadow-md"
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
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white placeholder:text-[#111827] text-[#111827] border border-input dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                  fullWidth
                />
              </div>
            </div>
          </header>

          <main className="p-4 flex-1">
            {user && (
              <div className="mb-4 text-white">
                Welcome, {user.name}!
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
                <p className="text-muted-foreground dark:text-gray-400">No conversations found</p>
                <Button variant="primary" size="sm" className="mt-4">
                  Start a new chat
                </Button>
              </motion.div>
            )}
          </main>
        </div>
      </div>
    </AnimatedPage>
  );
};

export default Dashboard;