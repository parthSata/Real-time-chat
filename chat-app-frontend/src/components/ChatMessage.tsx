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

    return (
        <motion.div
            variants={messageVariants}
            initial="initial"
            animate="animate"
            className={`chat-bubble ${message.isMe ? 'sent' : 'received'}`}
        >
            <div className="text-sm">{message.text}</div>
            <div className="text-xs mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </motion.div>
    );
};

export default ChatMessage;