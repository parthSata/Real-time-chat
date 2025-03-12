// index.js
import dotenv from "dotenv";
import ConnectDB from "./db/config.js";
import { server } from "./app.js"; // Import server instead of app

dotenv.config({
  path: "./env",
});

ConnectDB()
  .then(() => {
    server.listen(process.env.PORT || 8000, () => {
      console.log(`✅ Server is running at port : ${process.env.PORT || 8000}`);
    });
  })
  .catch((error) => {
    console.log("❌ MongoDb connection Failed !!!", error);
  });
