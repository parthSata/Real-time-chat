import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Chat {
  _id: string;
  participants: { _id: string; username: string; profilePic?: string; isOnline?: boolean; status?: string }[];
  lastMessage?: string;
  updatedAt: string;
  unread?: number;
}

interface ChatListProps {
  chats: Chat[];
}

const ChatList: React.FC<ChatListProps> = ({ chats }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return <div className="text-white">User not authenticated</div>;
  }

  return (
    <div className="space-y-3">
      {chats.map((chat) => {
        if (!Array.isArray(chat.participants) || chat.participants.length !== 2) {
          console.warn(`Invalid chat data for chat ${chat._id}:`, chat.participants);
          return (
            <div
              key={chat._id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-red-500"
            >
              Invalid chat data: Incorrect number of participants
            </div>
          );
        }

        // Ensure IDs are compared as strings
        const otherParticipant = chat.participants.find((p) => String(p._id) !== String(user.id));

        if (!otherParticipant) {
          console.error(`No other participant found for chat ${chat.participants[1]._id}. Participants:`, chat.participants[1], 'User ID:', chat.participants[1]._id);
          return (
            <div
              key={chat._id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-red-500"
            >
              Chat participant not found
            </div>
          );
        }


        return (
          <div
            key={chat._id}
            onClick={() => {
              if (!chat._id || typeof chat._id !== 'string') {
                return;
              }
              navigate(`/chat/${chat._id}`);
            }}
            className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
          >
            <div className="flex items-center">
              <img
                src={
                  otherParticipant.profilePic ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.participants[1].username}`
                }
                alt={otherParticipant.username}
                className="w-12 h-12 rounded-full mr-3"
              />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-foreground dark:text-white">
                    {otherParticipant.username}
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-gray-400">
                    {new Date(chat.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {chat.lastMessage ? (
                  <p className="text-sm text-muted-foreground dark:text-gray-400 truncate">
                    {chat.lastMessage}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground dark:text-gray-400 italic">
                    No messages yet
                  </p>
                )}
              </div>
              {chat.unread && chat.unread > 0 && (
                <span className="ml-2 px-2 py-1 text-xs font-semibold text-white bg-blue-500 rounded-full">
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