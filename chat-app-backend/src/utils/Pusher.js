import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.VITE_PUSHER_APP_ID,
  key: process.env.VITE_PUSHER_KEY,
  secret: process.env.VITE_PUSHER_SECRET,
  cluster: process.env.VITE_PUSHER_CLUSTER,
  useTLS: true,
});

export const triggerPusherEvent = (channel, event, data) => {
  try {
    pusher.trigger(channel, event, data);
  } catch (error) {
    console.error("Pusher trigger error:", error);
  }
};

export default pusher;
