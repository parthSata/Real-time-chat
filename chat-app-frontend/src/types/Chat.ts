// src/types/Chat.ts
export interface Chat {
  _id: string;
  participants: {
    _id: string;
    username: string;
    profilePic?: string;
    isOnline?: boolean;
    status?: string;
  }[];
  lastMessage?: string;
  updatedAt: string;
  createdAt?: string;
  isGroupChat?: boolean;
  messages?: string[];
  chatName?: string;
  __v?: number;
  unread?: number;
}
