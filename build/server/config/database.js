"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    try {
        // Use production URI if NODE_ENV is production, otherwise use development URI
        const mongoURI = process.env.NODE_ENV === "production"
            ? process.env.MONGODB_URI_PROD
            : process.env.MONGODB_URI || "mongodb://localhost:27017/soulcircle";
        if (!mongoURI) {
            throw new Error("MongoDB URI not found in environment variables");
        }
        console.log(`🔗 Connecting to MongoDB (${process.env.NODE_ENV || "development"} mode)...`);
        const conn = await mongoose_1.default.connect(mongoURI, {
            // Production-specific options
            ...(process.env.NODE_ENV === "production" && {
                retryWrites: true,
                retryReads: true,
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            }),
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        // Handle connection events
        mongoose_1.default.connection.on("disconnected", () => {
            console.log("❌ MongoDB disconnected");
        });
        mongoose_1.default.connection.on("error", (err) => {
            console.error("❌ MongoDB connection error:", err);
        });
        process.on("SIGINT", async () => {
            await mongoose_1.default.connection.close();
            console.log("🔌 MongoDB connection closed through app termination");
            process.exit(0);
        });
    }
    catch (error) {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
