import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Paperclip, Mic, MoreVertical, Phone, Video } from 'lucide-react';
import AnimatedPage from '../components/AnimatedPage';
import ChatMessage from '../components/ChatMessage';
import { useAuth } from '../context/AuthContext';



// Define the message interface
interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
  isMe: boolean;
}

// Mock data
const mockContacts: { [key: string]: any } = {
  '1': {
    id: '1',
    name: 'Sarah Johnson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    status: 'online',
  },
  '2': {
    id: '2',
    name: 'Michael Chen',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    status: 'offline',
  },
  '3': {
    id: '3',
    name: 'Jessica Williams',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica',
    status: 'online',
  },
  '4': {
    id: '4',
    name: 'David Rodriguez',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    status: 'away',
  },
  '5': {
    id: '5',
    name: 'Emma Thompson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
    status: 'online',
  },
};

const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: '1-1',
      text: 'Hey, how are you doing today?',
      sender: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      isMe: false,
    },
    {
      id: '1-2',
      text: 'I\'m doing great! Just finished a big project at work.',
      sender: 'me',
      timestamp: new Date(Date.now() - 1000 * 60 * 55),
      isMe: true,
    },
    {
      id: '1-3',
      text: 'That\'s awesome! Was it the one you were telling me about last week?',
      sender: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 50),
      isMe: false,
    },
    {
      id: '1-4',
      text: 'Yes, exactly! It was challenging but really rewarding in the end.',
      sender: 'me',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      isMe: true,
    },
    {
      id: '1-5',
      text: 'I knew you could do it! We should celebrate this weekend.',
      sender: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 40),
      isMe: false,
    },
  ],
  '2': [
    {
      id: '2-1',
      text: 'Did you see the latest project update?',
      sender: '2',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      isMe: false,
    },
    {
      id: '2-2',
      text: 'Not yet, what changed?',
      sender: 'me',
      timestamp: new Date(Date.now() - 1000 * 60 * 25),
      isMe: true,
    },
  ],
  '3': [
    {
      id: '3-1',
      text: 'Let\'s meet for coffee tomorrow!',
      sender: '3',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      isMe: false,
    },
  ],
  '4': [
    {
      id: '4-1',
      text: 'Thanks for your help with the presentation.',
      sender: '4',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
      isMe: false,
    },
    {
      id: '4-2',
      text: 'No problem at all! Happy to help anytime.',
      sender: 'me',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4.9),
      isMe: true,
    },
  ],
  '5': [
    {
      id: '5-1',
      text: 'I just sent you the files you requested.',
      sender: '5',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      isMe: false,
    },
    {
      id: '5-2',
      text: 'Got them, thank you!',
      sender: 'me',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 23.9),
      isMe: true,
    },
  ],
};

const ChatRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [contact, setContact] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (id && id in mockContacts) { // Use 'in' operator for type safety
      setContact(mockContacts[id]);
      setMessages(mockMessages[id] || []);
    } else {
      navigate('/dashboard');
    }
  }, [id, isAuthenticated, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() === '') return;

    const newMessage = {
      id: `${id}-${messages.length + 1}`,
      text: message,
      sender: 'me',
      timestamp: new Date(),
      isMe: true,
    };

    setMessages([...messages, newMessage]);
    setMessage('');

    // Simulate response
    setTimeout(() => {
      setIsTyping(true);
      
      setTimeout(() => {
        setIsTyping(false);
        
        const responseMessage = {
          id: `${id}-${messages.length + 2}`,
          text: getRandomResponse(),
          sender: id || '',
          timestamp: new Date(),
          isMe: false,
        };
        
        setMessages(prev => [...prev, responseMessage]);
      }, 2000);
    }, 1000);
  };

  const getRandomResponse = () => {
    const responses = [
      "That's interesting!",
      "I see what you mean.",
      "Thanks for sharing that.",
      "I'll think about it and get back to you.",
      "Good point!",
      "I agree with you.",
      "Let me check and confirm.",
      "That sounds like a plan!",
      "I appreciate your perspective.",
      "Let's discuss this further soon.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  if (!contact) return null;

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
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-10 h-10 rounded-full"
                />
                <div className="ml-3">
                  <h2 className="text-lg font-medium text-gray-800 dark:text-white">{contact.name}</h2>
                  <div className="flex items-center">
                    <span className={`h-2 w-2 rounded-full ${
                      contact.status === 'online' ? 'bg-green-500' : 
                      contact.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`}></span>
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                      {contact.status === 'online' ? 'Online' : 
                       contact.status === 'away' ? 'Away' : 'Offline'}
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

        <main className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <div className="space-y-1">
              <AnimatePresence>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="chat-bubble received"
                    style={{ maxWidth: '60px' }}
                  >
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </motion.div>
                )}
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