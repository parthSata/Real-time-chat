// Export a function to set up online status handling
export function setupOnlineSocket(io, onlineUsers) {
  io.on("connection", (socket) => {
    // Log when a user connects, using their unique socket ID
    console.log("A user connected:", socket.id);

    // Handle the "set-username" event when a user chooses their name
    socket.on("set-username", (username) => {
      // Store the username in the onlineUsers Map with the socket ID as the key
      onlineUsers.set(socket.id, username);
      // Broadcast the updated list of online users to all connected clients
      io.emit("users-online", Array.from(onlineUsers.values()));
      // Log the user's online status in the server console
    });

    // Handle the "disconnect" event when a user leaves
    socket.on("disconnect", () => {
      // Get the username associated with the disconnecting socket
      const username = onlineUsers.get(socket.id);
      // If the user had a username (was registered)
      if (username) {
        // Remove the user from the onlineUsers Map
        onlineUsers.delete(socket.id);
        // Broadcast the updated online users list to all clients
        io.emit("users-online", Array.from(onlineUsers.values()));
        // Log the disconnection in the server console
        console.log(`${username} disconnected`);
      }
    });
  });
}
