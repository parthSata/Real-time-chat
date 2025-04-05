import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { encrypt, decrypt } from "../utils/encryption.js";

class ChatController {
  constructor(io, onlineUsers) {
    this.io = io;
    this.onlineUsers = onlineUsers; // Map of socket IDs to user IDs
  }

  createChat = asyncHandler(async (req, res) => {
    const { username } = req.body;
    const currentUserId = req.user._id;

    if (!username) {
      throw new ApiError(400, "Username is required to create a chat");
    }

    const targetUser = await User.findOne({
      username: { $regex: `^${username}$`, $options: "i" },
    });
    if (!targetUser) {
      throw new ApiError(404, "User not found");
    }

    if (targetUser._id.toString() === currentUserId.toString()) {
      throw new ApiError(400, "Cannot create a chat with yourself");
    }

    const existingChat = await Chat.findOne({
      participants: { $all: [currentUserId, targetUser._id], $size: 2 },
      isGroupChat: false,
    });

    if (existingChat) {
      const populatedChat = await Chat.findById(existingChat._id)
        .populate("participants", "_id username profilePic isOnline status")
        .populate("lastMessage", "message")
        .lean();

      populatedChat._id = populatedChat._id.toString();
      populatedChat.isGroupChat = populatedChat.isGroupChat ?? false;
      if (populatedChat.lastMessage) {
        populatedChat.lastMessage._id =
          populatedChat.lastMessage._id.toString();
        populatedChat.lastMessage = populatedChat.lastMessage.message;
      }
      populatedChat.participants = populatedChat.participants.map(
        (participant) => ({
          ...participant,
          _id: participant._id.toString(),
        })
      );

      return res
        .status(200)
        .json(new ApiResponse(200, populatedChat, "Chat already exists"));
    }

    const chat = new Chat({
      participants: [currentUserId, targetUser._id],
      isGroupChat: false,
      chatName: targetUser.username,
    });
    await chat.save();

    const populatedChat = await Chat.findById(chat._id)
      .populate("participants", "_id username profilePic isOnline status")
      .populate("lastMessage", "message")
      .lean();

    if (populatedChat && populatedChat._id) {
      populatedChat._id = populatedChat._id.toString();
      populatedChat.isGroupChat = populatedChat.isGroupChat ?? false;
      populatedChat.chatName = populatedChat.chatName || targetUser.username;
      if (populatedChat.lastMessage) {
        populatedChat.lastMessage._id =
          populatedChat.lastMessage._id.toString();
        populatedChat.lastMessage = populatedChat.lastMessage.message;
      }
      populatedChat.participants = populatedChat.participants.map(
        (participant) => ({
          ...participant,
          _id: participant._id.toString(),
        })
      );
    }

    this.io.to(currentUserId.toString()).emit("newChat", populatedChat);
    this.io.to(targetUser._id.toString()).emit("newChat", populatedChat);

    return res
      .status(201)
      .json(new ApiResponse(201, populatedChat, "Chat created successfully"));
  });

  getMyChats = asyncHandler(async (req, res) => {
    const currentUserId = req.user._id;

    const chats = await Chat.find({ participants: currentUserId })
      .populate("participants", "_id username profilePic isOnline status")
      .populate("lastMessage", "message")
      .sort({ updatedAt: -1 })
      .lean();

    const formattedChats = chats.map((chat) => {
      const otherParticipant = chat.participants.find(
        (p) => p._id.toString() !== currentUserId.toString()
      );
      chat._id = chat._id.toString();
      chat.isGroupChat = chat.isGroupChat ?? false;
      chat.chatName = otherParticipant?.username || "Unknown User";
      if (chat.lastMessage) {
        chat.lastMessage._id = chat.lastMessage._id.toString();
        // Decrypt the lastMessage content
        try {
          chat.lastMessage.message = decrypt(chat.lastMessage.message);
        } catch (error) {
          console.error(
            `Failed to decrypt lastMessage for chat ${chat._id}:`,
            error.message
          );
        }
        chat.lastMessage = chat.lastMessage.message || "Message not available";
      } else {
        chat.lastMessage = undefined;
      }
      chat.participants = chat.participants.map((participant) => ({
        ...participant,
        _id: participant._id.toString(),
      }));
      delete chat.unreadCounts; // Remove the map from response if not needed
      return chat;
    });

    return res
      .status(200)
      .json(new ApiResponse(200, formattedChats, "Chats fetched successfully"));
  });

  sendMessage = asyncHandler(async (req, res) => {
    const { chatId, content } = req.body;
    const sender = req.user;

    if (!chatId || !content) {
      throw new ApiError(400, "Chat ID and message content are required");
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: sender._id,
    }).populate("participants", "isOnline");

    if (!chat) {
      throw new ApiError(404, "Chat not found or access denied");
    }

    const recipientId = chat.participants.find(
      (p) => p._id.toString() !== sender._id.toString()
    )?._id;
    const isRecipientOnline =
      this.onlineUsers.has(recipientId.toString()) ||
      chat.participants.find((p) => p._id.toString() === recipientId.toString())
        ?.isOnline;

    const timestamp = new Date(); // Consistent ISO timestamp
    const encryptedContent = encrypt(content); // Encrypt the message content

    const newMessage = new Message({
      recipient: recipientId,
      sender: sender._id,
      chatId: chat._id,
      message: encryptedContent,
      delivered: isRecipientOnline || false,
      isRead: false,
      timestamp: timestamp,
    });

    await newMessage.save();

    // Update unread counts
    chat.participants.forEach((participant) => {
      const participantId = participant._id.toString();
      if (participantId !== sender._id.toString()) {
        const currentCount = chat.unreadCounts.get(participantId) || 0;
        chat.unreadCounts.set(participantId, currentCount + 1);
      }
    });

    chat.lastMessage = newMessage._id;
    chat.updatedAt = new Date();
    await chat.save();

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "_id username profilePic")
      .populate("recipient", "_id username profilePic")
      .lean();

    if (populatedMessage) {
      populatedMessage._id = populatedMessage._id.toString();
      populatedMessage.chatId = populatedMessage.chatId.toString();
      populatedMessage.sender._id = populatedMessage.sender._id.toString();
      populatedMessage.recipient._id =
        populatedMessage.recipient._id.toString();
      populatedMessage.message = decrypt(populatedMessage.message); // Decrypt for response
      populatedMessage.timestamp = timestamp.toISOString(); // Ensure ISO string
    }

    chat.participants.forEach((participant) => {
      this.io.to(participant._id.toString()).emit("newMessage", {
        chatId: chatId.toString(),
        message: populatedMessage,
      });
    });

    if (isRecipientOnline) {
      this.io.to(recipientId.toString()).emit("messageDelivered", {
        messageId: newMessage._id.toString(),
      });
    }

    return res
      .status(201)
      .json(
        new ApiResponse(201, populatedMessage, "Message sent successfully")
      );
  });

  getChatById = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user._id;

    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
      throw new ApiError(400, "Invalid chat ID");
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    })
      .populate("participants", "_id username profilePic isOnline status")
      .lean();

    if (!chat) {
      throw new ApiError(404, "Chat not found or access denied");
    }

    chat._id = chat._id.toString();
    chat.isGroupChat = chat.isGroupChat ?? false;
    chat.participants = chat.participants.map((participant) => {
      participant._id = participant._id.toString();
      return participant;
    });

    return res
      .status(200)
      .json(new ApiResponse(200, chat, "Chat retrieved successfully"));
  });

  getChatMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      throw new ApiError(404, "Chat not found or access denied");
    }

    const messages = await Message.find({ chatId })
      .populate("sender", "_id username profilePic")
      .populate("recipient", "_id username profilePic")
      .sort({ timestamp: 1 })
      .lean();

    const formattedMessages = messages.map((message) => ({
      ...message,
      _id: message._id.toString(),
      chatId: message.chatId.toString(),
      sender: {
        ...message.sender,
        _id: message.sender._id.toString(),
      },
      recipient: {
        ...message.recipient,
        _id: message.recipient._id.toString(),
      },
      message: decrypt(message.message),
      timestamp: message.timestamp,
    }));

    return res
      .status(200)
      .json(
        new ApiResponse(200, formattedMessages, "Messages fetched successfully")
      );
  });

  markMessageAsRead = asyncHandler(async (req, res) => {
    const { messageId } = req.body;
    const userId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      recipient: userId,
    });
    if (!message) {
      throw new ApiError(404, "Message not found or access denied");
    }

    if (!message.isRead) {
      message.isRead = true;
      message.delivered = true;
      await message.save();

      // Update unread count
      const chat = await Chat.findById(message.chatId);
      const currentCount = chat.unreadCounts.get(userId.toString()) || 0;
      if (currentCount > 0) {
        chat.unreadCounts.set(userId.toString(), currentCount - 1);
        await chat.save();
      }

      this.io.to(message.chatId.toString()).emit("messageRead", {
        messageId: message._id.toString(),
      });
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Message marked as read"));
  });

  deleteChat = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOneAndDelete({
      _id: chatId,
      participants: userId,
    });
    if (!chat) throw new ApiError(404, "Chat not found or access denied");

    this.io.to(chatId).emit("chatDeleted", { chatId });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Chat deleted successfully"));
  });

  deleteMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { messageIds } = req.body;
    const userId = req.user._id;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      throw new ApiError(400, "Message IDs are required");
    }

    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat) throw new ApiError(404, "Chat not found or access denied");

    const deletedMessages = await Message.deleteMany({
      _id: { $in: messageIds },
      chatId,
      sender: userId, // Only allow deleting own messages
    });

    if (deletedMessages.deletedCount === 0) {
      throw new ApiError(404, "No messages found to delete");
    }

    this.io.to(chatId).emit("messagesDeleted", { chatId, messageIds });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Messages deleted successfully"));
  });
}

const initializeChatSocket = (io, onlineUsers) => {
  const chatController = new ChatController(io, onlineUsers);

  io.on("connection", (socket) => {
    socket.on("join", async (userId) => {
      onlineUsers.set(socket.id, userId);
      socket.join(userId);
      console.log(`User ${userId} joined with socket ${socket.id}`);

      // Fetch all chats for this user to notify participants
      const chats = await Chat.find({ participants: userId });
      chats.forEach((chat) => {
        chat.participants.forEach((participantId) => {
          if (participantId.toString() !== userId) {
            io.to(participantId.toString()).emit("userOnline", userId);
          }
        });
      });
    });

    socket.on("joinChat", (chatId) => {
      socket.join(chatId);
    });

    socket.on("leaveChat", (chatId) => {
      socket.leave(chatId);
    });

    socket.on("markAsRead", async ({ chatId, messageId }) => {
      const userId = onlineUsers.get(socket.id);
      const message = await Message.findOne({
        _id: messageId,
        recipient: userId,
      });
      if (message && !message.isRead) {
        message.isRead = true;
        message.delivered = true;
        await message.save();
        io.to(chatId).emit("messageRead", {
          messageId: message._id.toString(),
        });
      }
    });

    socket.on("disconnect", async () => {
      const userId = onlineUsers.get(socket.id);
      if (userId) {
        onlineUsers.delete(socket.id);
        console.log(`User ${userId} disconnected`);

        // Notify all relevant chat participants
        const chats = await Chat.find({ participants: userId });
        chats.forEach((chat) => {
          chat.participants.forEach((participantId) => {
            if (participantId.toString() !== userId) {
              io.to(participantId.toString()).emit("userOffline", userId);
            }
          });
        });
      }
    });
  });

  return chatController;
};

export default initializeChatSocket;
