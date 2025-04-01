import React from 'react';
import { motion } from 'framer-motion';

interface ChatMessageProps {
  message: {
    id: string;
    text: string;
    sender: string;
    timestamp: Date;
    isMe: boolean;
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${message.isMe ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div
        className={`max-w-xs px-4 py-2 rounded-lg ${message.isMe
          ? 'bg-primary-500 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
          }`}
      >
        <p>{message.text}</p>
        <p className="text-xs text-gray-400 mt-1">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </motion.div>
  );
};

export default ChatMessage;