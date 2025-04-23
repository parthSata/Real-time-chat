import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const ConnectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.VITE_MONGODB_URI}/${DB_NAME}`
    );
    console.log(
      `\n MongoDB Database is Connected !! DB HOST ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("Mongodb Connection error:", error);
    process.exit(1);
  }
};

export default ConnectDB;
