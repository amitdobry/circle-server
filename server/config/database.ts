import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  try {
    // Priority: MONGODB_URI > MONGODB_URI_PROD > localhost fallback
    const mongoURI =
      process.env.MONGODB_URI ||
      process.env.MONGODB_URI_PROD ||
      "mongodb://localhost:27017/soulcircle";

    if (!mongoURI) {
      throw new Error("MongoDB URI not found in environment variables");
    }

    console.log(
      `🔗 Connecting to MongoDB (${
        mongoURI.includes("mongodb+srv") ? "Atlas/Production" : "Local"
      } mode)...`
    );

    const conn = await mongoose.connect(mongoURI, {
      // Atlas/Production optimizations
      ...(mongoURI.includes("mongodb+srv") && {
        retryWrites: true,
        retryReads: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }),
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on("disconnected", () => {
      console.log("❌ MongoDB disconnected");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("🔌 MongoDB connection closed through app termination");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};
