// src/components/ChatList.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Chat {
  _id: string;
  participants: { _id: string; username: string }[];
  lastMessage?: string;
  updatedAt: string;
  unread?: number;
}

interface ChatListProps {
  chats: Chat[];
}

const ChatList: React.FC<ChatListProps> = ({ chats }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      {chats.map((chat) => {
        const otherParticipant = chat.participants.find((p) => p._id !== chat.participants[0]._id); // Adjust based on current user
        return (
          <div
            key={chat._id} // Ensure the key is unique
            onClick={() => navigate(`/chat/${chat._id}`)}
            className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground dark:text-white">
                  {otherParticipant?.username || 'Unknown User'}
                </p>
                {chat.lastMessage && (
                  <p className="text-sm text-muted-foreground dark:text-gray-400 truncate">
                    {chat.lastMessage}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground dark:text-gray-400">
                  {new Date(chat.updatedAt).toLocaleTimeString()}
                </p>
                {chat.unread && chat.unread > 0 && (
                  <span className="inline-block ml-2 px-2 py-1 text-xs font-semibold text-white bg-primary rounded-full">
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatList;