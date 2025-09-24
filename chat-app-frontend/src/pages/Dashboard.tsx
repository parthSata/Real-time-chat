import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, Plus, LogOut, Trash2, MessageSquare, User, Users } from 'lucide-react';
import AnimatedPage from '../components/AnimatedPage';
import ChatList from '../components/ChatList';
import ChatRoom from './ChatRoom';
import Sidebar from '../components/Sidebar';
import Input from '../components/Input';
import Button from '../components/Button';
import ProfileDialog from '../components/ProfileDialog';
import CreateGroupDialog from '../components/CreateGroupDialog';
import { useAuth } from '../context/AuthContext';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface User {
  _id: string;
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
  chatName: string;
  createdBy?: string;
  unread: number;
  onContextMenu?: (e: React.MouseEvent) => void;
  onClick?: () => void;
}

const Dashboard: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [error, setError] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: string } | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState<boolean>(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const { user, isAuthenticated, loading, logout, socket } = useAuth();
  const navigate = useNavigate();
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login');
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await fetch(`${VITE_API_BASE_URL}/api/v1/chats/my-chats`, {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json();
        if (data.success) {
          setChats(data.message.map((chat: Chat) => ({ ...chat, unread: 0 })));
        } else setError(data.message || 'Failed to fetch chats');
      } catch (err: any) {
        setError('Failed to fetch chats: ' + err.message);
      }
    };
    if (isAuthenticated) fetchChats();
  }, [isAuthenticated]);
  
  useEffect(() => {
    const searchUsers = async () => {
      if (!isSearchActive) return;

      const trimmedQuery = searchQuery.trim();
      const endpoint = trimmedQuery 
        ? `/api/v1/users/search?username=${trimmedQuery}` 
        : '/api/v1/users/all-users';
      
      try {
        const response = await fetch(`${VITE_API_BASE_URL}${endpoint}`, { credentials: 'include' });
        const data = await response.json();
        if (data.success) {
          setSearchedUsers(data.data);
          setError('');
        } else {
          setSearchedUsers([]);
          if(trimmedQuery) setError('No users found');
        }
      } catch (err) {
        setSearchedUsers([]);
        setError('Search failed');
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, isSearchActive]);


  useEffect(() => {
    if (!socket || !user) return;

    socket.on('newChat', (chat: Chat) => {
      setChats((prev) => (prev.some((c) => c._id === chat._id) ? prev : [{ ...chat, unread: 0 }, ...prev]));
    });

    socket.on('groupUpdated', (updatedChat: Chat) => {
      setChats((prev) => prev.map((c) => (c._id === updatedChat._id ? updatedChat : c)));
    });

    socket.on('removedFromGroup', ({ chatId }: { chatId: string }) => {
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      if (selectedChatId === chatId) setSelectedChatId(null);
    });

    socket.on('newMessage', (data: { chatId: string; message: { sender: { _id: string }; message: string; timestamp: string } }) => {
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === data.chatId && data.message.sender._id !== user?._id && chat._id !== selectedChatId
            ? { ...chat, lastMessage: data.message.message, updatedAt: data.message.timestamp, unread: (chat.unread || 0) + 1 }
            : chat
        )
      );
    });

    return () => {
      socket.off('newChat');
      socket.off('groupUpdated');
      socket.off('removedFromGroup');
      socket.off('newMessage');
    };
  }, [socket, user, selectedChatId]);
  
  const handleSearchFocus = () => {
    setIsSearchActive(true);
  };

  const handleSearchBlur = () => {
    setTimeout(() => setIsSearchActive(false), 200);
  };
  
  const handleCreateChat = async (username?: string) => {
    if (!username || username.trim() === '') {
        setError("Please select a user to start a chat.");
        return;
    }
    try {
      const response = await fetch(`${VITE_API_BASE_URL}/api/v1/chats/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await response.json();
      if (data.success) {
        setChats((prev) => (prev.some((c) => c._id === data.message._id) ? prev : [data.message, ...prev]));
        setSearchQuery('');
        setSelectedChatId(data.message._id);
        setIsSearchActive(false);
        setError('');
      } else {
        setError(data.message || 'Failed to create chat');
      }
    } catch (err: any) {
      setError('Failed to create chat: ' + err.message);
    }
  };

  const handleCreateGroup = async (groupName: string, participantUsernames: string[]) => {
    try {
      const response = await fetch(`${VITE_API_BASE_URL}/api/v1/chats/create-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groupName, participantUsernames }),
      });

      const data = await response.json();
      if (data.success) {
        setChats((prev) => [data.message, ...prev]);
        setIsGroupDialogOpen(false);
        setSelectedChatId(data.message._id);
      } else {
        setError(data.message || 'Failed to create group');
      }
    } catch (err: any) {
      setError('Failed to create group: ' + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err: any) {
      setError('Logout failed');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, chatId });
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      const response = await fetch(`${VITE_API_BASE_URL}/api/v1/chats/${chatId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        setChats((prev) => prev.filter((chat) => chat._id !== chatId));
        if (selectedChatId === chatId) setSelectedChatId(null);
      }
    } catch (err: any) {
      setError('Failed to delete chat: ' + err.message);
    } finally {
      setContextMenu(null);
      setShowDeleteDialog(null);
    }
  };

  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
    setChats((prev) => prev.map((chat) => (chat._id === chatId ? { ...chat, unread: 0 } : chat)));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return null;
  
  const filteredChats = isSearchActive 
    ? chats 
    : chats.filter(chat => 
        searchQuery ? chat.chatName.toLowerCase().includes(searchQuery.toLowerCase()) : true
      );

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className={`w-full md:w-1/3 lg:w-1/4 border-r bg-white dark:bg-gray-800 ${selectedChatId ? 'hidden md:block' : 'block'}`}>
          <header className="bg-white dark:bg-gray-800 shadow-sm">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-gray-500 hover:text-gray-600">
                  <Menu size={24} />
                </button>
                <h1 className="ml-2 md:ml-0 text-xl font-semibold text-gray-800 dark:text-white">Messages</h1>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsProfileDialogOpen(true)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100">
                  <User size={20} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleCreateChat()} className="p-2 rounded-full bg-[#0284c7] text-white">
                  <Plus size={20} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsGroupDialogOpen(true)} className="p-2 rounded-full bg-[#0284c7] text-white">
                  <Users size={20} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleLogout} className="p-2 rounded-full bg-red-500 text-white">
                  <LogOut size={20} />
                </motion.button>
              </div>
            </div>
            <div className="px-4 py-2 border-b">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  className="pl-10 bg-gray-100 border-none"
                />
              </div>
            </div>
          </header>
          <div className="h-[calc(100vh-8rem)] overflow-y-auto">
            {error && <div className="mb-4 p-3 bg-red-100 text-red-700">{error}</div>}
            
            {isSearchActive ? (
              <div>
                {searchedUsers.length > 0 ? (
                  searchedUsers.map((user) => (
                    <div key={user._id} onMouseDown={() => handleCreateChat(user.username)} className="flex items-center space-x-3 px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      <img src={user.profilePic || `https://api.dicebear.com/8.x/initials/svg?seed=${user.username}`} alt={user.username} className="w-10 h-10 rounded-full" />
                      <div className="flex-1"><p className="font-semibold text-gray-800 dark:text-white">{user.username}</p></div>
                    </div>
                  ))
                ) : ( <div className="text-center p-8 text-gray-500">{searchQuery ? 'No users found.' : 'Loading users...'}</div> )}
              </div>
            ) : (
              filteredChats.length > 0 ? (
                <ChatList chats={filteredChats.map((chat) => ({...chat, onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, chat._id), onClick: () => handleChatSelect(chat._id), }))} onChatSelect={handleChatSelect}/>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <MessageSquare size={40} className="text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">No conversations yet</h3>
                </div>
              )
            )}
          </div>
        </div>
        <div className={`w-full md:w-2/3 lg:w-3/4 bg-gray-50 dark:bg-gray-900 ${selectedChatId ? 'block' : 'hidden md:block'}`}>
          {selectedChatId ? (
            <ChatRoom key={selectedChatId} chatId={selectedChatId} onClose={() => setSelectedChatId(null)} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-8">
                <MessageSquare size={64} className="text-gray-400 mx-auto mb-6" />
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Select a chat to start messaging</h2>
              </div>
            </div>
          )}
        </div>
        <AnimatePresence>
          {contextMenu && (
            <motion.div
              ref={contextMenuRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl py-1 min-w-[160px]"
            >
              <button
                onClick={() => setShowDeleteDialog(contextMenu.chatId)}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-100"
              >
                <Trash2 size={16} className="mr-2 inline" /> Delete Chat
              </button>
            </motion.div>
          )}
          {showDeleteDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-opacity-50 flex items-center justify-center"
            >
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-80">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Chat</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Are you sure?</p>
                <div className="mt-4 flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={() => handleDeleteChat(showDeleteDialog)}>
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <ProfileDialog isOpen={isProfileDialogOpen} onClose={() => setIsProfileDialogOpen(false)} />
        <CreateGroupDialog isOpen={isGroupDialogOpen} onClose={() => setIsGroupDialogOpen(false)} onCreateGroup={handleCreateGroup}/>
      </div>
    </AnimatedPage>
  );
};

export default Dashboard;