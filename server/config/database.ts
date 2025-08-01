import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/soulcircle";

    const conn = await mongoose.connect(mongoURI, {
      // These options are no longer needed in newer versions of mongoose
      // but keeping them for compatibility
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
