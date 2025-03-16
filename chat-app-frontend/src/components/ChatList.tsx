import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Chat {
  _id: string;
  participants: { _id: string; username: string }[];
  lastMessage?: string; // Optional, as it might not exist yet
  updatedAt: string;
  unread?: number; // Optional, adjust based on your backend
}

interface ChatListProps {
  chats: Chat[];
}

const ChatList: React.FC<ChatListProps> = ({ chats }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {chats.map((chat) => {
        // Assuming the first participant that isn't the current user is the chat "name"
        const otherParticipant = chat.participants.find(
          (p) => p._id !== localStorage.getItem('userId') // Adjust based on AuthContext
        );
        return (
          <motion.div
            key={chat._id}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              to={`/chat/${chat._id}`}
              className="flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="relative">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipant?.username}`}
                  alt={otherParticipant?.username}
                  className="w-12 h-12 rounded-full"
                />
                {chat.unread && chat.unread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#0ea5e9] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {chat.unread}
                  </span>
                )}
              </div>
              <div className="ml-3 flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-white">{otherParticipant?.username}</h3>
                  <span className="text-xs text-gray-500">
                    {new Date(chat.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {chat.lastMessage || 'No messages yet'}
                </p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default ChatList;