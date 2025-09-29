// Backend: ChatController with corrected ApiResponse calls (data before message where swapped)

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

    if (!username || typeof username !== "string" || username.trim() === "") {
      throw new ApiError(400, "Username is required to create a chat.");
    }

    const targetUser = await User.findOne({ username });
    if (!targetUser) throw new ApiError(404, "User not found");
    if (targetUser._id.equals(currentUserId)) {
      throw new ApiError(400, "Cannot create a chat with yourself");
    }

    const existingChat = await Chat.findOne({
      isGroupChat: false,
      participants: { $all: [currentUserId, targetUser._id], $size: 2 },
    });

    // Function to format chat consistently
    const formatChatResponse = (chatDoc, currentUser) => {
      const chatPartner = !chatDoc.isGroupChat
        ? chatDoc.participants.find((p) => !p._id.equals(currentUser._id))
        : null;

      return {
        ...chatDoc,
        _id: chatDoc._id.toString(),
        chatName: chatDoc.isGroupChat
          ? chatDoc.chatName
          : chatPartner?.username,
        profilePic: chatDoc.isGroupChat ? null : chatPartner?.profilePic,
        participants: chatDoc.participants.map((p) => ({
          ...p,
          _id: p._id.toString(),
        })),
        lastMessage: "", // Default for new chats
        unread: 0,
      };
    };

    if (existingChat) {
      const populatedChat = await Chat.findById(existingChat._id)
        .populate("participants", "_id username profilePic isOnline status")
        .lean();

      const formattedChat = formatChatResponse(populatedChat, req.user);
      return res
        .status(200)
        .json(new ApiResponse(200, formattedChat, "Chat already exists"));
    }

    const newChatInstance = new Chat({
      participants: [currentUserId, targetUser._id],
      chatName: targetUser.username, // For 1-on-1, name is the other user
    });
    await newChatInstance.save();

    const populatedNewChat = await Chat.findById(newChatInstance._id)
      .populate("participants", "_id username profilePic isOnline status")
      .lean();

    const formattedChat = formatChatResponse(populatedNewChat, req.user);

    // Emit to both participants
    formattedChat.participants.forEach((participant) => {
      this.io.to(participant._id.toString()).emit("newChat", formattedChat);
    });

    return res
      .status(201)
      .json(new ApiResponse(201, formattedChat, "Chat created successfully"));
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

    // FIX: Correctly check if the creator is already in the participant list
    if (!participantIds.some((id) => id.equals(currentUserId))) {
      participantIds.push(currentUserId);
    }

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
      throw new ApiError(400, "User not in Group");
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

    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId) || !content) {
      throw new ApiError(400, "Valid chat ID and content are required");
    }

    try {
      const chat = await Chat.findOne({ _id: chatId, participants: sender._id })
        .populate("participants", "_id username profilePic isOnline status")
        .lean();
      if (!chat) {
        throw new ApiError(404, "Chat not found or access denied");
      }

      const recipientIds = chat.participants
        .filter((p) => p._id.toString() !== sender._id.toString())
        .map((p) => p._id);
      const encryptedContent = encrypt(content);

      let newMessage;
      if (chat.isGroupChat) {
        newMessage = new Message({
          sender: sender._id,
          chatId: chat._id,
          message: encryptedContent,
          messageType: "text",
          timestamp: new Date(),
          delivered: chat.participants.some(
            (p) => p.isOnline && !p._id.equals(sender._id)
          ),
          isRead: false,
        });
      } else {
        if (recipientIds.length !== 1) {
          throw new ApiError(
            400,
            "Invalid number of recipients for one-on-one chat"
          );
        }
        newMessage = new Message({
          recipient: recipientIds[0],
          sender: sender._id,
          chatId: chat._id,
          message: encryptedContent,
          messageType: "text",
          delivered: chat.participants.some(
            (p) => p.isOnline && !p._id.equals(sender._id)
          ),
          isRead: false,
          timestamp: new Date(),
        });
      }
      await newMessage.save();

      // Use plain object for unreadCounts
      const unreadCounts = chat.unreadCounts || {};
      chat.participants.forEach((participant) => {
        const participantId = participant._id.toString();
        if (participantId !== sender._id.toString()) {
          unreadCounts[participantId] = (unreadCounts[participantId] || 0) + 1;
        }
      });

      // Update chat with lastMessage and unreadCounts
      const updateData = {
        lastMessage: newMessage._id,
        updatedAt: new Date(),
        unreadCounts: unreadCounts,
      };
      await Chat.findByIdAndUpdate(
        chat._id,
        { $set: updateData },
        { new: true }
      );

      const populatedMessage = await Message.findById(newMessage._id)
        .populate("sender", "_id username profilePic")
        .populate("recipient", "_id username profilePic")
        .lean();
      if (!populatedMessage) {
        throw new ApiError(500, "Failed to populate message");
      }

      populatedMessage._id = populatedMessage._id.toString();
      populatedMessage.chatId = populatedMessage.chatId.toString();
      populatedMessage.sender._id = populatedMessage.sender._id.toString();
      if (populatedMessage.recipient) {
        populatedMessage.recipient._id =
          populatedMessage.recipient._id.toString();
      }
      populatedMessage.message =
        populatedMessage.messageType === "text"
          ? decrypt(populatedMessage.message)
          : populatedMessage.message;

      chat.participants.forEach((participant) => {
        if (this.io) {
          this.io.to(participant._id.toString()).emit("newMessage", {
            chatId: chatId.toString(),
            message: populatedMessage,
          });
        }
      });

      return res
        .status(201)
        .json(
          new ApiResponse(201, populatedMessage, "Message sent successfully")
        );
    } catch (error) {
      console.error("Error in sendMessage:", error);
      throw new ApiError(
        500,
        error.message || "Something went wrong on the server"
      );
    }
  });

  getMyChats = asyncHandler(async (req, res) => {
    const currentUserId = req.user._id;

    const chats = await Chat.find({ participants: currentUserId })
      .populate("participants", "_id username profilePic isOnline status")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "username",
        },
      })
      .sort({ updatedAt: -1 })
      .lean();

    const formattedChats = chats.map((chat) => {
      let lastMessageContent = "";
      if (chat.lastMessage) {
        const decryptedMessage =
          chat.lastMessage.messageType === "text"
            ? decrypt(chat.lastMessage.message)
            : "Media";

        if (chat.lastMessage.sender._id.equals(currentUserId)) {
          lastMessageContent = `You: ${decryptedMessage}`;
        } else {
          lastMessageContent = decryptedMessage;
        }
      }

      const chatPartner = !chat.isGroupChat
        ? chat.participants.find((p) => !p._id.equals(currentUserId))
        : null;

      // Initialize unreadCounts as a Map if it doesn't exist
      const unreadCount =
        chat.unreadCounts && chat.unreadCounts instanceof Map
          ? chat.unreadCounts.get(currentUserId.toString()) || 0
          : 0;

      return {
        _id: chat._id.toString(),
        chatName: chat.isGroupChat
          ? chat.chatName
          : chatPartner?.username || "Unknown",
        profilePic: chat.isGroupChat ? null : chatPartner?.profilePic,
        participants: chat.participants.map((p) => ({
          _id: p._id.toString(),
          username: p.username,
          profilePic: p.profilePic,
          isOnline: p.isOnline,
          status: p.status,
        })),
        lastMessage: lastMessageContent,
        updatedAt: chat.updatedAt,
        createdAt: chat.createdAt,
        isGroupChat: chat.isGroupChat,
        createdBy: chat.createdBy ? chat.createdBy.toString() : undefined,
        unread: unreadCount, // Send unread count to frontend
      };
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
      if (!chat) throw new ApiError(404, "Chat not found");

      // Use plain object for unreadCounts
      let unreadCounts = chat.unreadCounts || {};
      const currentCount = unreadCounts[userId.toString()] || 0;
      if (currentCount > 0) {
        unreadCounts[userId.toString()] = currentCount - 1;
        await Chat.findByIdAndUpdate(
          chat._id,
          { $set: { unreadCounts } },
          { new: true }
        );
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

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

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

    let recipientId;
    if (!chat.isGroupChat) {
      recipientId = chat.participants.find(
        (p) => p._id.toString() !== sender._id.toString()
      )?._id;
    }

    const isRecipientOnline =
      this.onlineUsers.has(recipientId?.toString()) ||
      chat.participants.find(
        (p) => p._id.toString() === recipientId?.toString()
      )?.isOnline;

    const newMessage = new Message({
      recipient: recipientId || null, // null for groups
      sender: sender._id,
      chatId: chat._id,
      message: uploadResult.secure_url,
      messageType: uploadResult.resource_type,
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
    if (populatedMessage.recipient) {
      populatedMessage.recipient._id =
        populatedMessage.recipient._id.toString();
    }

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

  initiateVideoCall = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat) throw new ApiError(404, "Chat not found or access denied");

    if (chat.isGroupChat) {
      throw new ApiError(400, "Video calls are not supported in group chats");
    }

    const recipientId = chat.participants.find(
      (p) => p._id.toString() !== userId.toString()
    )?._id;

    if (!recipientId) {
      throw new ApiError(400, "No recipient found for video call");
    }

    const callData = {
      chatId,
      initiatorId: userId.toString(),
      recipientId: recipientId.toString(),
      status: "initiated",
      createdAt: new Date(),
    };

    chat.participants.forEach((participant) => {
      this.io
        .to(participant._id.toString())
        .emit("videoCallInitiated", callData);
    });

    return res
      .status(200)
      .json(new ApiResponse(200, callData, "Video call initiated"));
  });
}

const initializeChatSocket = (io, onlineUsers) => {
  const chatController = new ChatController(io, onlineUsers);

  io.on("connection", (socket) => {
    socket.on("join", async (userId) => {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error("Invalid userId:", userId);
        return;
      }
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
      if (mongoose.Types.ObjectId.isValid(chatId)) {
        socket.join(chatId);
      } else {
        console.error("Invalid chatId:", chatId);
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
