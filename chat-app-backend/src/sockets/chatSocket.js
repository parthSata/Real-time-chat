// Export a function to set up chat functionality
export function setupChatSocket(io, onlineUsers) {
  // Listen for new socket connections
  io.on("connection", (socket) => {
    // Handle the "chat-message" event when a user sends a message
    socket.on("chat-message", (message) => {
      // Get the sender's username from the onlineUsers Map using their socket ID
      const username = onlineUsers.get(socket.id);
      // Only proceed if the user has a registered username
      if (username) {
        // Broadcast the message to all connected clients
        io.emit("chat-message", { 
          username,              // Sender's username
          message,              // The message content
          timestamp: new Date().toLocaleTimeString()  // Time the message was sent
        });
      }
    });
  });
}