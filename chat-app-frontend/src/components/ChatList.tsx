import React from 'react';
import { useAuth } from '../context/AuthContext';

interface Chat {
  _id: string;
  participants: { _id: string; username: string; profilePic?: string; isOnline?: boolean; status?: string }[];
  lastMessage?: string;
  updatedAt: string;
  unread?: number;
  onContextMenu?: (e: React.MouseEvent) => void;
  onClick?: () => void;
}

interface ChatListProps {
  chats: Chat[];
  onChatSelect?: (chatId: string) => void;
}

const ChatList: React.FC<ChatListProps> = ({ chats, onChatSelect }) => {
  const { user } = useAuth();

  if (!user) return <div className="text-gray-900 dark:text-white">User not authenticated</div>;

  return (
    <div>
      {chats.map((chat) => {
        if (!Array.isArray(chat.participants) || chat.participants.length !== 2) {
          console.warn(`Invalid chat data for chat ${chat._id}:`, chat.participants);
          return (
            <div
              key={chat._id}
              onClick={() => onChatSelect?.(chat._id)}
              className="p-4 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400"
            >
              Invalid chat data: Incorrect number of participants
            </div>
          );
        }

        const otherParticipant = chat.participants.find((p) => String(p._id) !== String(user.id));
        if (!otherParticipant) {
          console.error(`No other participant found for chat ${chat._id}. Participants:`, chat.participants, 'User ID:', user.id);
          return (
            <div key={chat._id} className="p-4 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400">
              Chat participant not found
            </div>
          );
        }

        return (
          <div
            key={chat._id}
            onClick={chat.onClick}
            onContextMenu={chat.onContextMenu}
            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div className="p-4 flex items-center space-x-4">
              <div>
                <img
                  src={otherParticipant.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipant.username}`}
                  alt={otherParticipant.username}
                  className="w-12 h-12 rounded-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{otherParticipant.username}</h3>
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
              {/* Only show unread badge if unread count is greater than 0 */}
              {chat.unread && chat.unread > 0 && (
                <span className="bg-[#0284c7] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
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