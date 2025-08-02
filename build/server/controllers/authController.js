"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.guestAuth = exports.updateProfile = exports.getProfile = exports.login = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
// Generate JWT token
const generateToken = (userId) => {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error("JWT_SECRET not configured");
    }
    return jsonwebtoken_1.default.sign({ userId }, jwtSecret, { expiresIn: "7d" });
};
// Register new user
const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        // Validate required fields
        if (!name || !email || !password) {
            res.status(400).json({
                message: "Name, email, and password are required",
            });
            return;
        }
        // Check if user already exists
        const existingUser = await User_1.User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            res.status(409).json({
                message: "User with this email already exists",
            });
            return;
        }
        // Create new user
        const user = new User_1.User({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
        });
        await user.save();
        // Generate token
        const token = generateToken(user._id.toString());
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        res.status(201).json({
            message: "User registered successfully",
            token,
            user: user.toJSON(),
        });
    }
    catch (error) {
        console.error("Registration error:", error);
        // Handle Mongoose validation errors
        if (error.name === "ValidationError") {
            const validationErrors = Object.values(error.errors).map((err) => err.message);
            res.status(400).json({
                message: "Validation failed",
                errors: validationErrors,
            });
            return;
        }
        // Handle duplicate key error (email already exists)
        if (error.code === 11000) {
            res.status(409).json({
                message: "User with this email already exists",
            });
            return;
        }
        // Handle other errors
        res.status(500).json({
            message: "Internal server error during registration",
        });
    }
};
exports.register = register;
// Login user
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validate required fields
        if (!email || !password) {
            res.status(400).json({
                message: "Email and password are required",
            });
            return;
        }
        // Find user by email
        const user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            res.status(401).json({
                message: "Invalid email or password",
            });
            return;
        }
        // Check password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            res.status(401).json({
                message: "Invalid email or password",
            });
            return;
        }
        // Generate token
        const token = generateToken(user._id.toString());
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        res.json({
            message: "Login successful",
            token,
            user: user.toJSON(),
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            message: "Internal server error during login",
        });
    }
};
exports.login = login;
// Get current user profile
const getProfile = async (req, res) => {
    try {
        if (!req.user) {
            // User is not authenticated - they are a guest
            res.status(200).json({
                user: null,
                isGuest: true,
            });
            return;
        }
        // Return user profile with name and avatarId for navigation logic
        const userProfile = req.user.toJSON();
        res.json({
            user: userProfile,
            isGuest: false,
            name: userProfile.name,
            avatarId: userProfile.avatar,
        });
    }
    catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({
            message: "Internal server error",
        });
    }
};
exports.getProfile = getProfile;
// Update user profile
const updateProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Not authenticated" });
            return;
        }
        const { name, avatar } = req.body;
        const updates = {};
        if (name)
            updates.name = name.trim();
        if (avatar)
            updates.avatar = avatar;
        const updatedUser = await User_1.User.findByIdAndUpdate(req.user._id, updates, {
            new: true,
            runValidators: true,
        }).select("-password");
        res.json({
            message: "Profile updated successfully",
            user: updatedUser?.toJSON(),
        });
    }
    catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            message: "Internal server error during profile update",
        });
    }
};
exports.updateProfile = updateProfile;
// Guest authentication - for users who want to join without full registration
const guestAuth = async (req, res) => {
    try {
        const { name, avatarId } = req.body;
        // Validate required fields
        if (!name || !avatarId) {
            res.status(400).json({
                message: "Name and avatarId are required for guest authentication",
            });
            return;
        }
        // Create guest user with a unique email
        const guestEmail = `guest_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}@guest.soulcircle.com`;
        const user = new User_1.User({
            name: name.trim(),
            email: guestEmail,
            avatar: avatarId,
            // No password for guest users
        });
        await user.save();
        // Generate token
        const token = generateToken(user._id.toString());
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        res.status(200).json({
            userId: user._id.toString(),
            token,
            user: user.toJSON(),
        });
    }
    catch (error) {
        console.error("Guest authentication error:", error);
        res.status(500).json({
            message: "Internal server error during guest authentication",
        });
    }
};
exports.guestAuth = guestAuth;
// Logout (client-side token removal, but we can track it server-side if needed)
const logout = async (req, res) => {
    // In JWT implementation, logout is typically handled client-side
    // by removing the token from storage
    res.json({
        message: "Logout successful. Please remove token from client storage.",
    });
};
exports.logout = logout;
