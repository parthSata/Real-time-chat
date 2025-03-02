import { setupOnlineSocket } from "./sockets/onlineSocket.js";
import { setupChatSocket } from "./sockets/chatSocket.js";
import { setupBothOnlineSocket } from "./sockets/bothOnlineSocket.js";

// Central place to manage all socket features
export function setupSockets(io) {
  const onlineUsers = new Map(); // Shared state for online users

  // Pass io and shared state to each socket module
  setupOnlineSocket(io, onlineUsers);
  setupChatSocket(io, onlineUsers);
  setupBothOnlineSocket(io, onlineUsers);
}