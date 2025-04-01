import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface ChatMessageProps {
  message: {
    id: string;
    text: string;
    sender: string;
    timestamp: Date;
    isMe: boolean;
    delivered?: boolean;
    isRead?: boolean;
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const words = message.text.split(/\s+/).filter(Boolean);
  const wordLimit = 100;
  const isLongMessage = words.length > wordLimit;
  const displayedText = isExpanded || !isLongMessage ? message.text : `${words.slice(0, wordLimit).join(' ')}...`;

  const renderTicks = () => {
    if (!message.isMe) return null; // Ticks only for sent messages
    if (!message.delivered) return <span className="text-gray-400">✓</span>; // Single tick (sent)
    if (!message.isRead) return <span className="text-gray-400">✓✓</span>; // Double tick (delivered)
    return <span className="text-blue-500">✓✓</span>; // Blue double tick (read)
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${message.isMe ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div
        className={`max-w-[450px] px-4 py-2 rounded-lg ${message.isMe
          ? 'bg-primary-500 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
          }`}
      >
        <p className="break-words">
          {displayedText}
          {isLongMessage && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`ml-2 text-xs underline ${message.isMe ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}
            >
              {isExpanded ? 'Read Less' : 'Read More'}
            </button>
          )}
        </p>
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-400 pr-2">
            {message.timestamp.toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {renderTicks()}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;