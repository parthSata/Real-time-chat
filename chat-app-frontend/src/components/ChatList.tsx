import React from 'react';
import { useAuth } from '../context/AuthContext';

interface Chat {
  _id: string;
  participants: { _id: string; username: string; profilePic?: string; isOnline?: boolean; status?: string }[];
  lastMessage?: string;
  updatedAt: string;
  isGroupChat: boolean;
  chatName: string;
  unread: number;
}

interface ChatListProps {
  chats: Chat[];
  onChatSelect: (chatId: string) => void;
  onContextMenu: (e: React.MouseEvent, chatId: string) => void;
}

const ChatList: React.FC<ChatListProps> = ({ chats, onChatSelect, onContextMenu }) => {
  const { user } = useAuth();

  if (!user) return <div className="text-gray-900 dark:text-white">User not authenticated</div>;

  return (
    <div>
      {chats.map((chat) => {
        const participants = Array.isArray(chat.participants) ? chat.participants : [];
        const otherParticipant = participants.find((p) => p._id !== user._id);
        const displayName = chat.isGroupChat ? chat.chatName : otherParticipant?.username || 'Unknown User';
        const profilePic = chat.isGroupChat
          ? `https://api.dicebear.com/7.x/initials/svg?seed=${chat.chatName}`
          : otherParticipant?.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`;

        return (
          <div
            key={chat._id}
            onClick={() => onChatSelect(chat._id)}
            onContextMenu={(e) => onContextMenu(e, chat._id)}
            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div className="p-4 flex items-center space-x-4">
              <img
                src={profilePic}
                alt={displayName}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`;
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName}</h3>
                  <p className="text-xs text-gray-500">
                    {new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {chat.lastMessage ? (
                  <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">No messages yet</p>
                )}
              </div>
              {chat.unread > 0 && (
                <span className="bg-[#0284c7] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {chat.unread}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatList;