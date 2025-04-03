import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Paperclip, Mic, Phone, Video, MoreVertical,  Trash2 } from 'lucide-react';
import ChatMessage from '../components/ChatMessage';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button'; // Assuming you have this component

const API_BASE_URL = 'http://localhost:3000';

interface ChatRoomProps {
  chatId: string;
  onClose: () => void;
}

interface Participant {
  _id: string;
  username: string;
  isOnline: boolean;
  profilePic?: string;
}

interface Message {
  _id: string;
  message: string;
  sender: { _id: string; username: string };
  recipient: { _id: string; username: string };
  chatId: string;
  timestamp: Date;
  delivered: boolean;
  isRead: boolean;
}

interface Chat {
  _id: string;
  participants: Participant[];
}

const ChatRoom: React.FC<ChatRoomProps> = ({ chatId, onClose }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, socket } = useAuth();

  // Load chat and messages
  useEffect(() => {
    if (!isAuthenticated || !chatId || !/^[0-9a-fA-F]{24}$/.test(chatId)) {
      setError('Invalid chat ID or not authenticated');
      onClose();
      return;
    }

    const loadChat = async () => {
      try {
        setLoading(true);
        setError(null);
        const [chatData, messagesData] = await Promise.all([
          fetchChat(chatId),
          fetchMessages(chatId),
        ]);
        setChat(chatData);
        setMessages(messagesData);
      } catch (err: any) {
        setError(err.message || 'Failed to load chat');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadChat();
  }, [chatId, isAuthenticated, onClose]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !chatId || !user) return;

    socket.emit('joinChat', chatId);

    const handleNewMessage = ({ chatId: incomingChatId, message }: { chatId: string; message: Message }) => {
      if (incomingChatId === chatId) {
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === message._id)) return prev;
          return [...prev, { ...message, timestamp: new Date(message.timestamp) }];
        });
      }
    };

    const handleMessageDelivered = ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, delivered: true } : msg))
      );
    };

    const handleMessageRead = ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, isRead: true, delivered: true } : msg))
      );
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageDelivered', handleMessageDelivered);
    socket.on('messageRead', handleMessageRead);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageDelivered', handleMessageDelivered);
      socket.off('messageRead', handleMessageRead);
      socket.emit('leaveChat', chatId);
    };
  }, [socket, chatId, user]);

  // Mark messages as read
  useEffect(() => {
    if (!socket || !chat || !user || loading) return;

    const unreadMessages = messages.filter((msg) => msg.sender._id !== user.id && !msg.isRead);
    unreadMessages.forEach((msg) => {
      socket.emit('markAsRead', { chatId, messageId: msg._id });
    });
  }, [messages, chat, user, socket, chatId, loading]);

  // Scroll to bottom
  useLayoutEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, messages]);

  // Handle click outside options menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setShowOptionsMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchChat = async (chatId: string): Promise<Chat> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/chats/${chatId}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to fetch chat');
    return data.message;
  };

  const fetchMessages = async (chatId: string): Promise<Message[]> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/chats/${chatId}/messages`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Failed to fetch messages');
    return (data.message || []).map((msg: Message) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
      delivered: msg.delivered ?? false,
      isRead: msg.isRead ?? false,
    }));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() === '' || !chatId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chats/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatId, content: message }),
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to send message');
      setMessage('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    if (isSelectionMode) {
      const newSelected = new Set(selectedMessages);
      if (newSelected.has(messageId)) {
        newSelected.delete(messageId);
      } else {
        newSelected.add(messageId);
      }
      setSelectedMessages(newSelected);
    }
  };

  const handleDeleteSelectedMessages = () => {
    setMessages(prev => prev.filter(msg => !selectedMessages.has(msg._id)));
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Loading chat...</div>;
  if (error) return <div className="h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!chat || !user) return <div className="h-screen flex items-center justify-center">Chat or user not found.</div>;

  const otherParticipant = chat.participants.find((p) => p._id !== user.id);
  if (!otherParticipant) return <div className="h-screen flex items-center justify-center">No other participant found.</div>;

  const profileImage = otherParticipant.profilePic
    ? `${otherParticipant.profilePic}`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipant.username}`;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="ml-3 flex items-center">
              <img
                src={profileImage}
                alt={otherParticipant.username}
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipant.username}`;
                }}
              />
              <div className="ml-3">
                <h2 className="text-lg font-medium text-gray-800 dark:text-white">{otherParticipant.username}</h2>
                <div className="flex items-center">
                  <span className={`h-2 w-2 rounded-full ${otherParticipant.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                    {otherParticipant.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isSelectionMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedMessages(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDeleteSelectedMessages}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Delete ({selectedMessages.size})
                </Button>
              </>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Phone size={20} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Video size={20} />
                </motion.button>
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    className="p-2 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <MoreVertical size={20} />
                  </motion.button>
                  <AnimatePresence>
                    {showOptionsMenu && (
                      <motion.div
                        ref={optionsMenuRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50"
                      >
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setIsSelectionMode(true);
                              setShowOptionsMenu(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                          >
                            <Trash2 size={16} className="mr-2" />
                            Select messages
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-1">
            <AnimatePresence>
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  onClick={() => toggleMessageSelection(msg._id)}
                  className={`relative ${isSelectionMode ? 'cursor-pointer' : ''}`}
                >
                  {isSelectionMode && (
                    <div
                      className={`absolute -left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full border-2 ${
                        selectedMessages.has(msg._id)
                          ? 'bg-[#0284c7] border-[#0284c7]'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                  )}
                  <ChatMessage
                    message={{
                      id: msg._id,
                      text: msg.message,
                      sender: msg.sender._id,
                      timestamp: new Date(msg.timestamp),
                      isMe: msg.sender._id === user.id,
                      delivered: msg.delivered,
                      isRead: msg.isRead,
                    }}
                  />
                </div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              className="p-2 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
            >
              <Paperclip size={20} />
            </motion.button>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0284c7] dark:text-white"
            />
            {message.trim() === '' ? (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                className="p-2 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
              >
                <Mic size={20} />
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="submit"
                className="p-2 rounded-full bg-[#0284c7] text-white"
              >
                <Send size={20} />
              </motion.button>
            )}
          </div>
        </form>
      </footer>
    </div>
  );
};

export default ChatRoom;