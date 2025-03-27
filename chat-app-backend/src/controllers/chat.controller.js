// controllers/chat.controller.js
import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

class ChatController {
  constructor(io, onlineUsers) {
    this.io = io;
    this.onlineUsers = onlineUsers;
  }

  createChat = asyncHandler(async (req, res) => {
    const { username } = req.body;
    const currentUserId = req.user._id;
    console.log(
      `Creating chat for user ${currentUserId} with username ${username}`
    );
    if (!username) {
      throw new ApiError(400, "Username is required to create a chat");
    }

    // Find the target user by username (case-insensitive)
    const targetUser = await User.findOne({
      username: { $regex: `^${username}$`, $options: "i" },
    });
    if (!targetUser) {
      throw new ApiError(404, "User not found");
    }

    if (targetUser._id.toString() === currentUserId.toString()) {
      throw new ApiError(400, "Cannot create a chat with yourself");
    }

    // Check if a chat already exists between the two users
    const existingChat = await Chat.findOne({
      participants: { $all: [currentUserId, targetUser._id] },
    });

    if (existingChat) {
      return res
        .status(200)
        .json(new ApiResponse(200, existingChat, "Chat already exists"));
    }

    // Create a new chat
    const chat = new Chat({
      participants: [currentUserId, targetUser._id],
    });
    await chat.save();

    // Populate the participants for the response
    const populatedChat = await Chat.findById(chat._id)
      .populate("participants", "_id username profilePic isOnline status")
      .lean();

    // Emit a Socket.IO event to notify both users
    this.io.to(currentUserId.toString()).emit("newChat", populatedChat);
    this.io.to(targetUser._id.toString()).emit("newChat", populatedChat);

    return res
      .status(201)
      .json(new ApiResponse(201, populatedChat, "Chat created successfully"));
  });

  // Fetch the current user's chats
  getMyChats = asyncHandler(async (req, res) => {
    const currentUserId = req.user._id;

    const chats = await Chat.find({ participants: currentUserId })
      .populate("participants", "_id username profilePic isOnline status")
      .sort({ updatedAt: -1 })
      .lean();

    return res
      .status(200)
      .json(new ApiResponse(200, chats, "Chats fetched successfully"));
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

    chat.messages = chat.messages || [];
    chat.messages.push(newMessage._id);
    chat.updatedAt = new Date();
    await chat.save();

    // Populate sender and recipient for the emitted message
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "username")
      .populate("recipient", "username");

    chat.participants.forEach((participantId) => {
      this.io.to(participantId.toString()).emit("newMessage", {
        chatId,
        message: populatedMessage,
      });
    });

    return res
      .status(201)
      .json(
        new ApiResponse(201, "Message sent successfully", populatedMessage)
      );
  });

  getChatById = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    }).populate("participants", "username");

    if (!chat) {
      throw new ApiError(404, "Chat not found or access denied");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, "Chat retrieved successfully", chat));
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
      .populate("sender", "username")
      .populate("recipient", "username")
      .sort({ timestamp: 1 });

    return res
      .status(200)
      .json(new ApiResponse(200, "Messages retrieved successfully", messages));
  });
}

const initializeChatSocket = (io, onlineUsers) => {
  const chatController = new ChatController(io, onlineUsers);

  io.on("connection", (socket) => {
    console.log("New socket connection:", socket.id);
    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return chatController;
};

export default initializeChatSocket;
