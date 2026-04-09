import mongoose from "mongoose";

export async function connectDB(uri) {
  try {
    if (!uri) throw new Error("MONGO_URI not set");
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
      autoIndex: true,
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error", err.message);
    process.exit(1);
  }
}
