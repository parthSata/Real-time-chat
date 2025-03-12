// controllers/chat.controller.js
import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

class ChatController {
  constructor(io) {
    this.io = io;
  }

  createChat = asyncHandler(async (req, res) => {
    const { username } = req.body;
    const currentUser = req.user;

    const recipient = await User.findOne({ username });
    if (!recipient) {
      throw new ApiError(404, "User not found");
    }

    if (recipient._id.toString() === currentUser._id.toString()) {
      throw new ApiError(400, "Cannot create chat with yourself");
    }

    const existingChat = await Chat.findOne({
      isGroupChat: false,
      participants: { $all: [currentUser._id, recipient._id], $size: 2 },
    });

    if (existingChat) {
      return res
        .status(200)
        .json(new ApiResponse(200, "Chat already exists", existingChat));
    }

    const newChat = new Chat({
      isGroupChat: false,
      participants: [currentUser._id, recipient._id],
    });

    await newChat.save();

    this.io.to(currentUser._id.toString()).emit("newChat", newChat);
    this.io.to(recipient._id.toString()).emit("newChat", newChat);

    return res
      .status(201)
      .json(new ApiResponse(201, "Chat created successfully", newChat));
  });

  sendMessage = asyncHandler(async (req, res) => {
    const { chatId, content } = req.body;
    const sender = req.user;

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
    });

    await newMessage.save();

    chat.updatedAt = new Date();
    await chat.save();

    chat.participants.forEach((participantId) => {
      this.io.to(participantId.toString()).emit("newMessage", {
        chatId,
        message: newMessage,
      });
    });

    return res
      .status(201)
      .json(new ApiResponse(201, "Message sent successfully", newMessage));
  });

  getUserChats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const chats = await Chat.find({ participants: userId })
      .populate("participants", "username")
      .sort({ updatedAt: -1 });

    return res
      .status(200)
      .json(new ApiResponse(200, "Chats retrieved successfully", chats));
  });
}

const initializeChatSocket = (io) => {
  const chatController = new ChatController(io);

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
