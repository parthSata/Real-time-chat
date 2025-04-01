import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Paperclip, Mic, MoreVertical, Phone, Video } from 'lucide-react';
import AnimatedPage from '../components/AnimatedPage';
import ChatMessage from '../components/ChatMessage';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'http://localhost:3000';

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

const ChatRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, socket } = useAuth();
  const [loggedMessageIds, setLoggedMessageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      console.log(`Invalid chat ID detected: ${id}`);
      setError('Invalid chat ID format');
      navigate('/dashboard');
      return;
    }

    const loadChat = async () => {
      try {
        setLoading(true);
        setError(null);
        const chatData = await fetchChat(id);
        if (!chatData || !chatData._id) {
          throw new Error('Chat data is invalid or empty');
        }
        setChat(chatData);
        const messagesData = await fetchMessages(id);
        setMessages(messagesData);
      } catch (err: any) {
        console.error('Error loading chat:', err.message);
        setError(err.message || 'Failed to load chat. Please try again.');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    loadChat();
  }, [id, isAuthenticated, navigate]);

  useEffect(() => {
    if (!socket || !id || !user) return;

    socket.emit('joinChat', id);

    socket.on('newMessage', ({ chatId, message }: { chatId: string; message: Message }) => {
      if (chatId === id) {
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === message._id)) return prev;
          return [...prev, { ...message, timestamp: new Date(message.timestamp) }];
        });
      }
    });

    socket.on('messageDelivered', ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, delivered: true } : msg
        )
      );
    });

    socket.on('messageRead', ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, isRead: true, delivered: true } : msg
        )
      );
    });

    return () => {
      socket.off('newMessage');
      socket.off('messageDelivered');
      socket.off('messageRead');
      socket.emit('leaveChat', id);
    };
  }, [socket, id, user]);

  useEffect(() => {
    if (chat && user && socket && !loading) {
      messages.forEach((msg) => {
        if (msg.sender._id !== user.id && !msg.isRead) {
          socket.emit('markAsRead', { chatId: id, messageId: msg._id });
        }
      });
    }
  }, [messages, chat, user, socket, id, loading]);

  useLayoutEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom();
    }
  }, [loading, messages]);

  useEffect(() => {
    if (user && messages.length > 0) {
      const newMessages = messages.filter((msg) => !loggedMessageIds.has(msg._id));
      newMessages.forEach((msg) => {
        const isMe = msg.sender._id === user.id;
        console.log(
          `Sender ID: ${msg.sender._id}, Receiver ID: ${msg.recipient._id}, User ID: ${user.id}, isMe: ${isMe}, Delivered: ${msg.delivered}, Read: ${msg.isRead}`
        );
        setLoggedMessageIds((prev) => new Set(prev).add(msg._id));
      });
    }
  }, [messages, user]);

  const fetchChat = async (chatId: string): Promise<Chat> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/chats/${chatId}`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! Status: ${response.status}`);
    }
    if (!data.success || !data.message) {
      throw new Error('Invalid chat data received from server');
    }
    return data.message;
  };

  const fetchMessages = async (chatId: string): Promise<Message[]> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/chats/${chatId}/messages`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Fetch messages error:', data);
      throw new Error(data.message || `HTTP error! Status: ${response.status}`);
    }
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch messages');
    }
    return (data.message || []).map((msg: Message) => ({
      ...msg,
      timestamp: new Date(msg.timestamp), // Parse ISO string to Date
      delivered: msg.delivered ?? false, // Default to false if undefined
      isRead: msg.isRead ?? false, // Default to false if undefined
    }));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() === '' || !id) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chats/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatId: id, content: message }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }
      const data = await response.json();
      if (data.success) setMessage('');
    } catch (err) {
      console.error('Send message error:', err);
      setError('Failed to send message. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-white">Loading chat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!chat || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-white">Chat or user not found. Redirecting...</p>
      </div>
    );
  }

  const otherParticipant = chat.participants.find((p) => p._id !== user.id);

  if (!otherParticipant) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-white">No other participant found in this chat.</p>
      </div>
    );
  }

  const profileImage = otherParticipant.profilePic
    ? `${otherParticipant.profilePic}`
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipant.username}`;

  return (
    <AnimatedPage>
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/dashboard')}
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
                    <span className={`h-2 w-2 rounded-full ${otherParticipant.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                      {otherParticipant.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
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
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
              >
                <MoreVertical size={20} />
              </motion.button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-y-auto" style={{ minHeight: 0 }}>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-1">
              {Array.isArray(messages) && messages.length > 0 ? (
                messages.map((msg) => (
                  <ChatMessage
                    key={msg._id}
                    message={{
                      id: msg._id,
                      text: msg.message,
                      sender: msg.sender._id,
                      timestamp: new Date(msg.timestamp),
                      isMe: msg.sender._id === user.id,
                      delivered: msg.delivered ?? false,
                      isRead: msg.isRead ?? false,
                    }}
                  />
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center">No messages yet.</p>
              )}
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
                className="message-input flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
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
                  className="p-2 rounded-full bg-primary-500 text-white"
                >
                  <Send size={20} />
                </motion.button>
              )}
            </div>
          </form>
        </footer>
      </div>
    </AnimatedPage>
  );
};

export default ChatRoom;