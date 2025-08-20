// import fs from "fs";
// import multer from "multer";
// import path from "path";

// const uploadPath = path.resolve("public/temp");

// // Create the directory if it doesn't exist
// if (!fs.existsSync(uploadPath)) {
//   fs.mkdirSync(uploadPath, { recursive: true });
// }

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, uploadPath);
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.originalname);
//   },
// });

// export const upload = multer({ storage });

import multer from "multer";

// We no longer need the 'fs' or 'path' imports,
// as we are not interacting with the local file system.

// Use multer.memoryStorage() instead of multer.diskStorage().
// This stores the file in memory as a buffer, which is perfect for
// directly uploading to a cloud service like Cloudinary.
const storage = multer.memoryStorage();

export const upload = multer({ storage });
