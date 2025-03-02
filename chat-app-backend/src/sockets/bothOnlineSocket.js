// Export a function to set up "both online" status checking
export function setupBothOnlineSocket(io, onlineUsers) {
  // Listen for new socket connections
  io.on("connection", (socket) => {
    // Handle the "check-both-online" event when a client requests status
    socket.on("check-both-online", () => {
      // Get the current number of online users
      const userCount = onlineUsers.size;
      // Check if at least two users are online
      if (userCount >= 2) {
        // Broadcast to all clients that both persons are online
        io.emit("both-online", {
          status: true,                   // Indicates success (two or more online)
          message: "Both persons are online!", // Status message
          count: userCount                // Number of online users
        });
      } else {
        // Send a message only to the requesting client if less than two are online
        socket.emit("both-online", {
          status: false,                  // Indicates waiting state
          message: "Waiting for another user...", // Status message
          count: userCount                // Number of online users
        });
      }
    });
  });
}