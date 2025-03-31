import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";

class ChatController {
  constructor(io, onlineUsers) {
    this.io = io;
    this.onlineUsers = onlineUsers;
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
    });
    await chat.save();

    const populatedChat = await Chat.findById(chat._id)
      .populate("participants", "_id username profilePic isOnline status")
      .populate("lastMessage", "message")
      .lean();

    if (populatedChat && populatedChat._id) {
      populatedChat._id = populatedChat._id.toString();
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
      chat.chatName = otherParticipant?.username || "Unknown User"; // Add chatName
      if (chat.lastMessage) {
        chat.lastMessage._id = chat.lastMessage._id.toString();
        chat.lastMessage = chat.lastMessage.message || "Message not available";
      } else {
        chat.lastMessage = undefined;
      }
      chat.participants = chat.participants.map((participant) => ({
        ...participant,
        _id: participant._id.toString(),
      }));
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
    });

    if (!chat) {
      throw new ApiError(404, "Chat not found or access denied");
    }

    const newMessage = new Message({
      recipient: chat.participants.find(
        (id) => id.toString() !== sender._id.toString()
      ),
      sender: sender._id,
      chatId: chat._id,
      message: content,
      isRead: false,
      timestamp: new Date(),
    });

    await newMessage.save();

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
    }

    chat.participants.forEach((participantId) => {
      const participantIdStr = participantId.toString();
      this.io.to(participantIdStr).emit("newMessage", {
        chatId: chatId.toString(),
        message: populatedMessage,
      });
    });

    const senderSocketId = [...this.onlineUsers.entries()].find(
      ([_, userId]) => userId === sender._id.toString()
    )?.[0];
    if (senderSocketId) {
      this.io.emit("chat-message", {
        userId: sender._id.toString(),
        message: content,
        timestamp: new Date().toLocaleTimeString(),
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
    }));

    return res
      .status(200)
      .json(
        new ApiResponse(200, formattedMessages, "Messages fetched successfully")
      );
  });
}

const initializeChatSocket = (io, onlineUsers) => {
  const chatController = new ChatController(io, onlineUsers);

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join", (userId) => {
      console.log(`User ${userId} joined with socket ID ${socket.id}`);
      onlineUsers.set(socket.id, userId);
      socket.join(userId);
      console.log("Updated onlineUsers:", [...onlineUsers.entries()]);
    });

    socket.on("chat-message", (message) => {
      const userId = onlineUsers.get(socket.id);
      if (userId) {
        io.emit("chat-message", {
          userId,
          message,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    });

    socket.on("disconnect", () => {
      const userId = onlineUsers.get(socket.id);
      console.log(`User disconnected: ${socket.id}, userId: ${userId}`);
      onlineUsers.delete(socket.id);
      console.log("Updated onlineUsers after disconnect:", [
        ...onlineUsers.entries(),
      ]);
    });
  });

  return chatController;
};

export default initializeChatSocket;
