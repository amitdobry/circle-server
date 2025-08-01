"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Local Authentication Routes
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
router.post('/logout', authController_1.logout);
// Protected Routes
router.get('/profile', auth_1.authenticateToken, authController_1.getProfile);
router.put('/profile', auth_1.authenticateToken, authController_1.updateProfile);
// Google OAuth Routes (only if configured)
router.get('/google', ((req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(404).json({ message: 'Google OAuth not configured' });
    }
    passport_1.default.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
}));
router.get('/google/callback', ((req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=oauth_not_configured`);
    }
    passport_1.default.authenticate('google', { failureRedirect: '/login' })(req, res, next);
}), (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=auth_failed`);
        }
        // Generate JWT token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET not configured');
        }
        const token = jsonwebtoken_1.default.sign({ userId: user._id }, jwtSecret, { expiresIn: '7d' });
        // Redirect to frontend with token
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?token=${token}&user=${encodeURIComponent(JSON.stringify(user.toJSON()))}`);
    }
    catch (error) {
        console.error('Google callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=auth_failed`);
    }
});
// Check authentication status
router.get('/check', auth_1.authenticateToken, ((req, res) => {
    res.json({ authenticated: true, user: req.user });
}));
exports.default = router;
