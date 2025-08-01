"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurePassport = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const User_1 = require("../models/User");
const configurePassport = () => {
    // Only configure Google OAuth if credentials are provided
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (googleClientId && googleClientSecret) {
        console.log('🔐 Configuring Google OAuth strategy...');
        // Google OAuth Strategy
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: googleClientId,
            clientSecret: googleClientSecret,
            callbackURL: "/api/auth/google/callback"
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists with this Google ID
                let user = await User_1.User.findOne({ googleId: profile.id });
                if (user) {
                    // Update last login
                    user.lastLogin = new Date();
                    await user.save();
                    return done(null, user);
                }
                // Check if user exists with same email
                user = await User_1.User.findOne({ email: profile.emails?.[0]?.value });
                if (user) {
                    // Link Google account to existing user
                    user.googleId = profile.id;
                    if (profile.photos?.[0]?.value) {
                        user.avatar = profile.photos[0].value;
                    }
                    user.lastLogin = new Date();
                    await user.save();
                    return done(null, user);
                }
                // Create new user
                const newUser = new User_1.User({
                    googleId: profile.id,
                    name: profile.displayName || profile.name?.givenName + ' ' + profile.name?.familyName || 'Google User',
                    email: profile.emails?.[0]?.value || '',
                    avatar: profile.photos?.[0]?.value || null
                });
                await newUser.save();
                return done(null, newUser);
            }
            catch (error) {
                console.error('Google OAuth error:', error);
                return done(error, false);
            }
        }));
    }
    else {
        console.log('⚠️  Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable');
    }
    // Serialize user for session
    passport_1.default.serializeUser((user, done) => {
        done(null, user._id);
    });
    // Deserialize user from session
    passport_1.default.deserializeUser(async (id, done) => {
        try {
            const user = await User_1.User.findById(id).select('-password');
            done(null, user);
        }
        catch (error) {
            done(error, false);
        }
    });
};
exports.configurePassport = configurePassport;
