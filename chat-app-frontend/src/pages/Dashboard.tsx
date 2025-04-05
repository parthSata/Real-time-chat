import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, Plus, LogOut, Trash2, MessageSquare, User } from 'lucide-react';
import AnimatedPage from '../components/AnimatedPage';
import ChatList from '../components/ChatList';
import ChatRoom from './ChatRoom';
import Sidebar from '../components/Sidebar';
import Input from '../components/Input';
import Button from '../components/Button';
import ProfileDialog from '../components/ProfileDialog';
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
  participants: { _id: string; username: string; profilePic?: string; isOnline?: boolean; status?: string }[];
  lastMessage?: string;
  updatedAt: string;
  createdAt: string;
  isGroupChat: boolean;
  messages?: string[];
  chatName: string;
  unreadCounts?: { [userId: string]: number };
  unread?: number;
  onContextMenu?: (e: React.MouseEvent) => void;
  onClick?: () => void;
}

interface Message {
  _id: string;
  sender: { _id: string; username: string; profilePic?: string };
  recipient: { _id: string; username: string; profilePic?: string };
  chatId: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

const Dashboard: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [error, setError] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: string } | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const { user, isAuthenticated, loading, logout, socket } = useAuth();
  const navigate = useNavigate();
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const currentUser: User | null = user;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/chats/my-chats`, {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        if (data.success) {
          const fetchedChats = (data.message || []).map((chat: Chat) => ({
            ...chat,
            isGroupChat: chat.isGroupChat ?? false,
            createdAt: chat.createdAt || new Date().toISOString(),
            chatName: chat.chatName || 'Unknown Chat',
            unread: 0,
          }));
          setChats(fetchedChats);
          setError('');
        } else {
          setChats([]);
          setError(data.message || 'Failed to fetch chats');
        }
      } catch (err: any) {
        setChats([]);
        setError('Failed to fetch chats: ' + err.message);
      }
    };

    if (isAuthenticated) fetchChats();
  }, [isAuthenticated]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(chats);
      setSearchedUser(null);
      setError('');
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = chats.filter((chat) => {
        const otherParticipant = chat.participants?.find((p) => p._id !== currentUser?.id);
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
    if (!socket || !user) return;

    socket.on('newChat', (chat: Chat) => {
      setChats((prev) => {
        if (prev.some((existingChat) => existingChat._id === chat._id)) return prev;
        return [{ ...chat, unread: 0, isGroupChat: chat.isGroupChat ?? false, createdAt: chat.createdAt || new Date().toISOString(), chatName: chat.chatName || 'Unknown Chat' }, ...prev];
      });
    });

    socket.on('newMessage', (data: { chatId: string; message: Message }) => {
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === data.chatId && data.message.sender._id !== user.id && chat._id !== selectedChatId
            ? { ...chat, lastMessage: data.message.message, updatedAt: data.message.timestamp, unread: (chat.unread || 0) + 1 }
            : chat
        )
      );
    });

    socket.on('messageRead', ({ messageId }: { messageId: string }) => {
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.messages?.includes(messageId) && chat.unread && chat.unread > 0) {
            return { ...chat, unread: chat.unread - 1 };
          }
          return chat;
        })
      );
    });

    return () => {
      socket.off('newChat');
      socket.off('newMessage');
      socket.off('messageRead');
    };
  }, [socket, user, selectedChatId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const searchUser = async (username: string): Promise<void> => {
    if (!username.trim()) {
      setSearchedUser(null);
      setError('');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/search?username=${username}`, { credentials: 'include' });
      if (!response.ok) throw new Error((await response.json()).message || 'User not found');
      const data = await response.json();
      if (data.success) {
        setSearchedUser(data.data);
        setError('');
      } else {
        setSearchedUser(null);
        setError('User not found');
      }
    } catch (err: any) {
      setSearchedUser(null);
      setError('User not found');
    }
  };

  const handleCreateChat = async (username?: string): Promise<void> => {
    try {
      const targetUsername = username || searchQuery.trim();
      if (!targetUsername) throw new Error('Please enter a username to start a chat');
      const response = await fetch(`${API_BASE_URL}/api/v1/chats/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: targetUsername }),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to create chat');
      const data = await response.json();
      if (data.success) {
        const newChat = { ...data.message, unread: 0, isGroupChat: data.message.isGroupChat ?? false, createdAt: data.message.createdAt || new Date().toISOString(), chatName: data.message.chatName || 'Unknown Chat' };
        setChats((prev) => prev.some((chat) => chat._id === newChat._id) ? prev : [newChat, ...prev]);
        setSearchQuery('');
        setError('');
        setSelectedChatId(newChat._id);
      } else {
        setError('Failed to create chat');
      }
    } catch (err: any) {
      setError('Failed to create chat: ' + err.message);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setError('Logout failed');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, chatId });
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chats/${chatId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete chat');
      setChats((prev) => prev.filter((chat) => chat._id !== chatId));
      setFilteredChats((prev) => prev.filter((chat) => chat._id !== chatId));
      if (selectedChatId === chatId) setSelectedChatId(null);
    } catch (err: any) {
      setError('Failed to delete chat: ' + err.message);
    } finally {
      setContextMenu(null);
      setShowDeleteDialog(null);
    }
  };

  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
    setChats((prev) =>
      prev.map((chat) => (chat._id === chatId ? { ...chat, unread: 0 } : chat))
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><p className="text-gray-800 dark:text-white">Loading...</p></div>;
  if (!isAuthenticated) return null;

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        {/* ChatList Container */}
        <div
          className={`w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${selectedChatId ? 'hidden md:block' : 'block'
            }`}
        >
          <header className="bg-white dark:bg-gray-800 shadow-sm">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors">
                  <Menu size={24} />
                </button>
                <h1 className="ml-2 md:ml-0 text-xl font-semibold text-gray-800 dark:text-white">Messages</h1>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsProfileDialogOpen(true)} className="p-2 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors">
                  <User size={20} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleCreateChat()} className="p-2 rounded-full bg-[#0284c7] text-white shadow-md hover:bg-[#0270a8] transition-colors">
                  <Plus size={20} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleLogout} className="p-2 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors">
                  <LogOut size={20} />
                </motion.button>
              </div>
            </div>
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-gray-400" />
                </div>
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-100 border-none focus:ring-2 focus:ring-[#0284c7] transition-all duration-200"
                  fullWidth
                />
              </div>
            </div>
          </header>
          <div className="h-[calc(100vh-8rem)] overflow-y-auto">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm mx-4 shadow-sm">
                {error}
              </motion.div>
            )}
            {filteredChats.length > 0 ? (
              <div onContextMenu={(e) => e.preventDefault()}>
                <ChatList
                  chats={filteredChats.map(chat => ({
                    ...chat,
                    onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, chat._id),
                    onClick: () => handleChatSelect(chat._id),
                  }))}
                  onChatSelect={handleChatSelect}
                />
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 shadow-md">
                  <MessageSquare size={40} className="text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No conversations yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">{searchQuery.trim() ? 'No matching conversations found' : 'Start chatting with your friends'}</p>
                {searchQuery.trim() && searchedUser && (
                  <Button variant="primary" size="sm" onClick={() => handleCreateChat(searchQuery)} className="bg-[#0284c7] hover:bg-[#0270a8] transition-colors">
                    Start a new chat with {searchQuery}
                  </Button>
                )}
              </motion.div>
            )}
          </div>
        </div>
        {/* ChatRoom Container */}
        <div
          className={`w-full md:w-2/3 lg:w-3/4 bg-gray-50 dark:bg-gray-900 ${selectedChatId ? 'block' : 'hidden md:block'
            }`}
        >
          {selectedChatId ? (
            <ChatRoom key={selectedChatId} chatId={selectedChatId} onClose={() => setSelectedChatId(null)} />
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <MessageSquare size={64} className="text-gray-400" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Select a chat to start messaging</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">Choose from your existing conversations or start a new one with your contacts</p>
              </div>
            </motion.div>
          )}
        </div>
        <AnimatePresence>
          {contextMenu && (
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 50 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl py-1 min-w-[160px] border border-gray-200 dark:border-gray-700"
            >
              <button
                onClick={() => setShowDeleteDialog(contextMenu.chatId)}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center transition-colors"
              >
                <Trash2 size={16} className="mr-2" />
                Delete Chat
              </button>
            </motion.div>
          )}
          {showDeleteDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-opacity-50 backdrop-blur-md flex items-center justify-center z-50"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-80">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Chat</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Are you sure you want to delete this chat? This action cannot be undone.</p>
                <div className="mt-4 flex justify-end space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(null)}>Cancel</Button>
                  <Button variant="primary" size="sm" onClick={() => handleDeleteChat(showDeleteDialog)} className="bg-red-500 hover:bg-red-600">Delete</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <ProfileDialog isOpen={isProfileDialogOpen} onClose={() => setIsProfileDialogOpen(false)} />
      </div>
    </AnimatedPage>
  );
};

export default Dashboard;