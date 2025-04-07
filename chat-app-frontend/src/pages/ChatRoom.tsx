import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Paperclip, Mic, Phone, Video, MoreVertical, Trash2 } from 'lucide-react';
import ChatMessage from '../components/ChatMessage';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';

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
  sender: { _id: string; username: string; profilePic?: string };
  recipient?: { _id: string; username: string; profilePic?: string };
  chatId: string;
  timestamp: Date;
  delivered: boolean;
  isRead: boolean;
}

interface Chat {
  _id: string;
  participants: Participant[];
  isGroupChat: boolean;
  chatName: string;
  createdBy: string;
}

interface ChatRoomProps {
  chatId: string;
  onClose: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ chatId, onClose }) => {
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false);
  const [showParticipantsDialog, setShowParticipantsDialog] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { user, socket } = useAuth();

  useEffect(() => {
    const loadChat = async () => {
      try {
        setLoading(true);
        const [chatResponse, messagesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/chats/${chatId}`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/v1/chats/${chatId}/messages`, { credentials: 'include' }),
        ]);
        const chatData = await chatResponse.json();
        const messagesData = await messagesResponse.json();

        if (!chatData.success || !messagesData.success) throw new Error('Failed to load chat data');
        setChat(chatData.message);
        setMessages(messagesData.message.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })));
      } catch (err: any) {
        setError(err.message || 'Failed to load chat');
        onClose();
      } finally {
        setLoading(false);
      }
    };
    loadChat();
  }, [chatId, onClose]);

  useEffect(() => {
    if (!socket || !chatId || !user || !chat) return;

    socket.emit('joinChat', chatId);

    socket.on('newMessage', ({ chatId: incomingChatId, message }: { chatId: string; message: Message }) => {
      if (incomingChatId === chatId) {
        setMessages((prev) =>
          prev.some((m) => m._id === message._id)
            ? prev
            : [...prev, { ...message, timestamp: new Date(message.timestamp) }]
        );
      }
    });

    socket.on('groupUpdated', (updatedChat: Chat) => {
      if (updatedChat._id === chatId) setChat(updatedChat);
    });

    socket.on('messagesDeleted', ({ chatId: deletedChatId, messageIds }: { chatId: string; messageIds: string[] }) => {
      if (deletedChatId === chatId) {
        setMessages((prev) => prev.filter((msg) => !messageIds.includes(msg._id)));
      }
    });

    return () => {
      socket.off('newMessage');
      socket.off('groupUpdated');
      socket.off('messagesDeleted');
      socket.emit('leaveChat', chatId);
    };
  }, [socket, chatId, user, chat]);

  useLayoutEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(event.target as Node) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(event.target as Node)
      ) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !chatId || !user || !chat) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chats/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatId, content: message }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      setMessage('');
      formRef.current?.reset();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chats/remove-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatId, userIdToRemove: userId }),
      });
      if (!response.ok) throw new Error('Failed to remove user');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleMessageSelection = (messageId: string) => {
    if (isSelectionMode) {
      const newSelected = new Set(selectedMessages);
      if (newSelected.has(messageId)) newSelected.delete(messageId);
      else newSelected.add(messageId);
      setSelectedMessages(newSelected);
    }
  };

  const handleDeleteSelectedMessages = async () => {
    try {
      const messageIds = Array.from(selectedMessages);
      const response = await fetch(`${API_BASE_URL}/api/v1/chats/${chatId}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageIds }),
      });
      if (!response.ok) throw new Error('Only USe');
      setSelectedMessages(new Set());
      setIsSelectionMode(false);
    } catch (err: any) {
      setError('Failed to delete messages: ' + err.message);
    }
  };

  if (error) return <div className="h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!chat || !user) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  const displayName = chat.isGroupChat ? chat.chatName : chat.participants.find((p) => p._id !== user._id)?.username || 'Unknown';

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-600">
              <ArrowLeft size={20} />
            </button>
            <div
              className="ml-3 flex items-center cursor-pointer"
              onClick={() => chat.isGroupChat && setShowParticipantsDialog(true)}
            >
              <img
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`}
                alt={displayName}
                className="w-10 h-10 rounded-full"
              />
              <div className="ml-3">
                <h2 className="text-lg font-medium text-gray-800 dark:text-white">{displayName}</h2>
                {chat.isGroupChat ? (
                  <p className="text-xs text-gray-500">{chat.participants.length} members</p>
                ) : (
                  <div className="flex items-center">
                    <span
                      className={`h-2 w-2 rounded-full ${chat.participants.find((p) => p._id !== user._id)?.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                    ></span>
                    <span className="ml-1 text-xs text-gray-500">
                      {chat.participants.find((p) => p._id !== user._id)?.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                )}
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
                  disabled={selectedMessages.size === 0}
                >
                  Delete ({selectedMessages.size})
                </Button>
              </>
            ) : (
              <>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-gray-500 hover:text-gray-600">
                  <Phone size={20} />
                </motion.button>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="p-2 text-gray-500 hover:text-gray-600">
                  <Video size={20} />
                </motion.button>
                <div className="relative">
                  <motion.button
                    ref={moreButtonRef}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowOptionsMenu((prev) => !prev)}
                    className="p-2 text-gray-500 hover:text-gray-600"
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
                        className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 z-50"
                      >
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setIsSelectionMode(true);
                              setShowOptionsMenu(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100"
                          >
                            <Trash2 size={16} className="mr-2 inline" /> Select and Delete
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

      <main className="flex-1 p-4 overflow-y-auto relative">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence>
            {messages.map((msg) => (
              <div
                key={msg._id}
                onClick={() => toggleMessageSelection(msg._id)}
                className={`relative mb-2 ${isSelectionMode ? 'cursor-pointer' : ''}`}
              >
                {isSelectionMode && (
                  <div
                    className={`absolute -left-6 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full border-2 ${selectedMessages.has(msg._id) ? 'bg-[#0284c7] border-[#0284c7]' : 'border-gray-300'}`}
                  />
                )}
                <div className={`flex ${msg.sender._id === user._id ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-xs">
                    {chat.isGroupChat && msg.sender._id !== user._id && (
                      <p className="text-xs text-gray-500 mb-1">{msg.sender.username}</p>
                    )}
                    <ChatMessage
                      message={{
                        id: msg._id,
                        text: msg.message,
                        sender: msg.sender._id,
                        timestamp: msg.timestamp,
                        isMe: msg.sender._id === user._id,
                        delivered: msg.delivered,
                        isRead: msg.isRead,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
        <AnimatePresence>
          {showParticipantsDialog && chat.isGroupChat && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Group Members</h3>
                  <button onClick={() => setShowParticipantsDialog(false)} className="p-2 text-gray-500 hover:text-gray-600">
                    <ArrowLeft size={20} />
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {chat.participants.map((p) => (
                    <div key={p._id} className="flex justify-between items-center">
                      <span className="text-gray-900 dark:text-white">{p.username}</span>
                      {chat.createdBy === user._id && p._id !== user._id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveUser(p._id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t p-4">
        <form ref={formRef} onSubmit={handleSendMessage} className="max-w-3xl mx-auto">
          <div className="flex items-center space-x-2">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" className="p-2 text-gray-500">
              <Paperclip size={20} />
            </motion.button>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none dark:text-white"
            />
            {message.trim() === '' ? (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="button" className="p-2 text-gray-500">
                <Mic size={20} />
              </motion.button>
            ) : (
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} type="submit" className="p-2 bg-[#0284c7] text-white rounded-full">
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