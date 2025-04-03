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

  const messageVariants = {
    initial: {
      opacity: 0,
      y: 20,
      x: message.isMe ? 20 : -20
    },
    animate: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
  };

  const renderTicks = () => {
    if (!message.isMe) return null; // No ticks for received messages, as in the screenshot
    if (!message.delivered) return <span className="text-gray-600">✓</span>;
    if (!message.isRead) return <span className=" text-gray-600">✓✓</span>;
    return <span className="text-blue-600">✓✓</span>;
  };

  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      className={`chat-bubble ${message.isMe ? 'sent' : 'received'} flex ${message.isMe ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div className="flex flex-col">
        <div
          className={`px-2  rounded-lg  ${message.isMe
            ? 'bg-primary-500 text-[#bed5ed]  '
            : '  text-gray-800 '
            }`}
        >
          <div className="text-lg  break-words">
            {displayedText}
            {isLongMessage && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`ml-2 text-sm underline ${message.isMe ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}
              >
                {isExpanded ? 'Read Less' : 'Read More'}
              </button>
            )}
          </div>
        </div>
        <div
          className={`text-xs mt-1  ${message.isMe ? 'text-right text-gray-800' : 'text-left text-gray-400'
            }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {message.isMe && <span className="ml-2 text-xl">{renderTicks()}</span>}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;