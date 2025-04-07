import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { encrypt, decrypt } from "../utils/encryption.js";
import { uploadInCloudinary } from "../utils/cloudinary.js";

class ChatController {
  constructor(io, onlineUsers) {
    this.io = io;
    this.onlineUsers = onlineUsers;
  }

  createChat = asyncHandler(async (req, res) => {
    const { username } = req.body;
    const currentUserId = req.user._id;

    const targetUser = await User.findOne({
      username: { $regex: `^${username}$`, $options: "i" },
    });
    if (!targetUser) throw new ApiError(404, "User not found");
    if (targetUser._id.toString() === currentUserId.toString())
      throw new ApiError(400, "Cannot create a chat with yourself");

    const existingChat = await Chat.findOne({
      participants: { $all: [currentUserId, targetUser._id], $size: 2 },
      isGroupChat: false,
    });

    if (existingChat) {
      const populatedChat = await Chat.findById(existingChat._id)
        .populate("participants", "_id username profilePic isOnline status")
        .populate("lastMessage", "message messageType")
        .lean();
      populatedChat._id = populatedChat._id.toString();
      populatedChat.participants = populatedChat.participants.map((p) => ({
        ...p,
        _id: p._id.toString(),
      }));
      if (populatedChat.lastMessage) {
        populatedChat.lastMessage.message =
          populatedChat.lastMessage.messageType === "text"
            ? decrypt(populatedChat.lastMessage.message)
            : populatedChat.lastMessage.message;
        populatedChat.lastMessage = populatedChat.lastMessage.message;
      }
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
      .populate("lastMessage", "message messageType")
      .lean();
    populatedChat._id = populatedChat._id.toString();
    populatedChat.participants = populatedChat.participants.map((p) => ({
      ...p,
      _id: p._id.toString(),
    }));
    if (populatedChat.lastMessage) {
      populatedChat.lastMessage.message =
        populatedChat.lastMessage.messageType === "text"
          ? decrypt(populatedChat.lastMessage.message)
          : populatedChat.lastMessage.message;
      populatedChat.lastMessage = populatedChat.lastMessage.message;
    }

    this.io.to(currentUserId.toString()).emit("newChat", populatedChat);
    this.io.to(targetUser._id.toString()).emit("newChat", populatedChat);

    return res
      .status(201)
      .json(new ApiResponse(201, populatedChat, "Chat created successfully"));
  });

  createGroupChat = asyncHandler(async (req, res) => {
    const { groupName, participantUsernames } = req.body;
    const currentUserId = req.user._id;

    if (
      !groupName ||
      !participantUsernames ||
      !Array.isArray(participantUsernames) ||
      participantUsernames.length < 1
    ) {
      throw new ApiError(
        400,
        "Group name and at least one participant username are required"
      );
    }

    const participants = await User.find({
      username: { $in: participantUsernames },
    }).select("_id");
    if (participants.length !== participantUsernames.length)
      throw new ApiError(404, "One or more users not found");

    const participantIds = participants.map((p) => p._id);
    if (!participantIds.includes(currentUserId))
      participantIds.push(currentUserId);

    const groupChat = new Chat({
      isGroupChat: true,
      chatName: groupName,
      participants: participantIds,
      createdBy: currentUserId,
    });
    await groupChat.save();

    const populatedChat = await Chat.findById(groupChat._id)
      .populate("participants", "_id username profilePic isOnline status")
      .populate("lastMessage", "message messageType")
      .lean();
    populatedChat._id = populatedChat._id.toString();
    populatedChat.participants = populatedChat.participants.map((p) => ({
      ...p,
      _id: p._id.toString(),
    }));
    if (populatedChat.lastMessage) {
      populatedChat.lastMessage.message =
        populatedChat.lastMessage.messageType === "text"
          ? decrypt(populatedChat.lastMessage.message)
          : populatedChat.lastMessage.message;
      populatedChat.lastMessage = populatedChat.lastMessage.message;
    }

    participantIds.forEach((id) => {
      this.io.to(id.toString()).emit("newChat", populatedChat);
    });

    return res
      .status(201)
      .json(
        new ApiResponse(201, populatedChat, "Group chat created successfully")
      );
  });

  removeUserFromGroup = asyncHandler(async (req, res) => {
    const { chatId, userIdToRemove } = req.body;
    const currentUserId = req.user._id;

    if (
      !mongoose.Types.ObjectId.isValid(chatId) ||
      !mongoose.Types.ObjectId.isValid(userIdToRemove)
    ) {
      throw new ApiError(400, "Invalid chat ID or user ID");
    }

    const chat = await Chat.findOne({
      _id: chatId,
      isGroupChat: true,
      createdBy: currentUserId,
    });
    if (!chat)
      throw new ApiError(
        403,
        "Chat not found or you don't have permission to remove users"
      );

    if (
      !chat.participants.some(
        (id) => id.toString() === userIdToRemove.toString()
      )
    ) {
      throw new ApiError(400, "User not in group");
    }

    chat.participants = chat.participants.filter(
      (id) => id.toString() !== userIdToRemove.toString()
    );
    await chat.save();

    const populatedChat = await Chat.findById(chatId)
      .populate("participants", "_id username profilePic isOnline status")
      .populate("lastMessage", "message messageType")
      .lean();
    populatedChat._id = populatedChat._id.toString();
    populatedChat.participants = populatedChat.participants.map((p) => ({
      ...p,
      _id: p._id.toString(),
    }));
    if (populatedChat.lastMessage) {
      populatedChat.lastMessage.message =
        populatedChat.lastMessage.messageType === "text"
          ? decrypt(populatedChat.lastMessage.message)
          : populatedChat.lastMessage.message;
      populatedChat.lastMessage = populatedChat.lastMessage.message;
    }

    chat.participants.forEach((id) => {
      this.io.to(id.toString()).emit("groupUpdated", populatedChat);
    });
    this.io.to(userIdToRemove.toString()).emit("removedFromGroup", { chatId });

    return res
      .status(200)
      .json(new ApiResponse(200, populatedChat, "User removed from group"));
  });

  sendMessage = asyncHandler(async (req, res) => {
    const { chatId, content } = req.body;
    const sender = req.user;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: sender._id,
    }).populate("participants", "isOnline");
    if (!chat) throw new ApiError(404, "Chat not found or access denied");

    const recipientIds = chat.participants
      .filter((p) => p._id.toString() !== sender._id.toString())
      .map((p) => p._id);
    const encryptedContent = encrypt(content);

    const newMessage = new Message({
      recipient: recipientIds[0], // For group chats, this could be null or handled differently
      sender: sender._id,
      chatId: chat._id,
      message: encryptedContent,
      messageType: "text", // Explicitly set as text
      delivered: chat.participants.some(
        (p) => p.isOnline && p._id.toString() !== sender._id.toString()
      ),
      isRead: false,
      timestamp: new Date(),
    });
    await newMessage.save();

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
    populatedMessage._id = populatedMessage._id.toString();
    populatedMessage.chatId = populatedMessage.chatId.toString();
    populatedMessage.sender._id = populatedMessage.sender._id.toString();
    if (populatedMessage.recipient)
      populatedMessage.recipient._id =
        populatedMessage.recipient._id.toString();
    // Decrypt here for real-time emission
    populatedMessage.message =
      populatedMessage.messageType === "text"
        ? decrypt(populatedMessage.message)
        : populatedMessage.message;

    chat.participants.forEach((participant) => {
      this.io.to(participant._id.toString()).emit("newMessage", {
        chatId: chatId.toString(),
        message: populatedMessage,
      });
    });

    return res
      .status(201)
      .json(
        new ApiResponse(201, populatedMessage, "Message sent successfully")
      );
  });

  getMyChats = asyncHandler(async (req, res) => {
    const currentUserId = req.user._id;

    const chats = await Chat.find({ participants: currentUserId })
      .populate("participants", "_id username profilePic isOnline status")
      .populate("lastMessage", "message messageType")
      .sort({ updatedAt: -1 })
      .lean();

    const formattedChats = chats.map((chat) => {
      chat._id = chat._id.toString();
      chat.participants = chat.participants.map((p) => ({
        ...p,
        _id: p._id.toString(),
      }));
      if (chat.lastMessage) {
        chat.lastMessage._id = chat.lastMessage._id.toString();
        // Only decrypt if it's a text message
        chat.lastMessage.message =
          chat.lastMessage.messageType === "text"
            ? decrypt(chat.lastMessage.message)
            : chat.lastMessage.message;
        chat.lastMessage = chat.lastMessage.message;
      }
      return chat;
    });

    return res
      .status(200)
      .json(new ApiResponse(200, formattedChats, "Chats fetched successfully"));
  });

  getChatById = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, participants: userId })
      .populate("participants", "_id username profilePic isOnline status")
      .populate("lastMessage", "message messageType")
      .lean();
    if (!chat) throw new ApiError(404, "Chat not found or access denied");

    chat._id = chat._id.toString();
    chat.participants = chat.participants.map((p) => ({
      ...p,
      _id: p._id.toString(),
    }));
    if (chat.lastMessage) {
      chat.lastMessage.message =
        chat.lastMessage.messageType === "text"
          ? decrypt(chat.lastMessage.message)
          : chat.lastMessage.message;
      chat.lastMessage = chat.lastMessage.message;
    }

    return res
      .status(200)
      .json(new ApiResponse(200, chat, "Chat retrieved successfully"));
  });

  getChatMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat) throw new ApiError(404, "Chat not found or access denied");

    const messages = await Message.find({ chatId })
      .populate("sender", "_id username profilePic")
      .populate("recipient", "_id username profilePic")
      .sort({ timestamp: 1 })
      .lean();

    const formattedMessages = messages.map((message) => ({
      ...message,
      _id: message._id.toString(),
      chatId: message.chatId.toString(),
      sender: { ...message.sender, _id: message.sender._id.toString() },
      recipient: message.recipient
        ? { ...message.recipient, _id: message.recipient._id.toString() }
        : null,
      message:
        message.messageType === "text"
          ? decrypt(message.message)
          : message.message,
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
    if (!message) throw new ApiError(404, "Message not found or access denied");

    if (!message.isRead) {
      message.isRead = true;
      message.delivered = true;
      await message.save();

      const chat = await Chat.findById(message.chatId);
      const currentCount = chat.unreadCounts.get(userId.toString()) || 0;
      if (currentCount > 0) {
        chat.unreadCounts.set(userId.toString(), currentCount - 1);
        await chat.save();
      }

      this.io
        .to(message.chatId.toString())
        .emit("messageRead", { messageId: message._id.toString() });
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

    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat) throw new ApiError(404, "Chat not found or access denied");

    const deletedMessages = await Message.deleteMany({
      _id: { $in: messageIds },
      chatId,
      $or: [{ sender: userId }, { recipient: userId }],
    });

    if (deletedMessages.deletedCount === 0)
      throw new ApiError(404, "No messages found to delete");

    chat.participants.forEach((id) => {
      this.io.to(id.toString()).emit("messagesDeleted", { chatId, messageIds });
    });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Messages deleted successfully"));
  });

  uploadMedia = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const sender = req.user;
    const file = req.file;

    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
      throw new ApiError(400, "Invalid chat ID");
    }

    if (!file) {
      throw new ApiError(400, "Media file is required");
    }

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

    if (file.mimetype.startsWith("image") && file.size > MAX_IMAGE_SIZE) {
      throw new ApiError(400, "Image size exceeds 10MB limit");
    }
    if (file.mimetype.startsWith("video") && file.size > MAX_VIDEO_SIZE) {
      throw new ApiError(400, "Video size exceeds 100MB limit");
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: sender._id,
    }).populate("participants", "isOnline");

    if (!chat) {
      throw new ApiError(404, "Chat not found or access denied");
    }

    const uploadResult = await uploadInCloudinary(file.path);
    if (!uploadResult) {
      throw new ApiError(500, "Failed to upload media to Cloudinary");
    }

    const recipientId = chat.participants.find(
      (p) => p._id.toString() !== sender._id.toString()
    )?._id;

    const isRecipientOnline =
      this.onlineUsers.has(recipientId.toString()) ||
      chat.participants.find((p) => p._id.toString() === recipientId.toString())
        ?.isOnline;

    const newMessage = new Message({
      recipient: recipientId,
      sender: sender._id,
      chatId: chat._id,
      message: uploadResult.secure_url,
      messageType: uploadResult.resource_type, // 'image' or 'video'
      delivered: isRecipientOnline || false,
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

    populatedMessage._id = populatedMessage._id.toString();
    populatedMessage.chatId = populatedMessage.chatId.toString();
    populatedMessage.sender._id = populatedMessage.sender._id.toString();
    populatedMessage.recipient._id = populatedMessage.recipient._id.toString();

    chat.participants.forEach((participant) => {
      this.io.to(participant._id.toString()).emit("newMessage", {
        chatId: chatId.toString(),
        message: populatedMessage,
      });
    });

    return res
      .status(201)
      .json(
        new ApiResponse(201, populatedMessage, "Media uploaded successfully")
      );
  });
}

const initializeChatSocket = (io, onlineUsers) => {
  const chatController = new ChatController(io, onlineUsers);

  io.on("connection", (socket) => {
    socket.on("join", async (userId) => {
      if (!mongoose.Types.ObjectId.isValid(userId)) return;
      onlineUsers.set(socket.id, userId);
      socket.join(userId);
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
      if (mongoose.Types.ObjectId.isValid(chatId)) socket.join(chatId);
    });

    socket.on("leaveChat", (chatId) => {
      if (mongoose.Types.ObjectId.isValid(chatId)) socket.leave(chatId);
    });

    socket.on("markAsRead", async ({ chatId, messageId }) => {
      const userId = onlineUsers.get(socket.id);
      if (
        !mongoose.Types.ObjectId.isValid(userId) ||
        !mongoose.Types.ObjectId.isValid(messageId)
      )
        return;
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
