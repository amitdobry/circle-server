import express, { Response, Request, NextFunction } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import {
  register,
  login,
  getProfile,
  updateProfile,
  logout,
  guestAuth,
} from "../controllers/authController";
import {
  authenticateToken,
  optionalAuth,
  AuthRequest,
} from "../middleware/auth";
import { IUser } from "../models/User";

const router = express.Router();

// Local Authentication Routes
router.post("/register", register as any);
router.post("/login", login as any);
router.post("/guest", guestAuth as any);
router.post("/logout", logout as any);

// Protected Routes
router.get("/profile", optionalAuth as any, getProfile as any);
router.put("/profile", authenticateToken as any, updateProfile as any);

// Google OAuth Routes (only if configured)
router.get("/google", ((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(404).json({ message: "Google OAuth not configured" });
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next
  );
}) as any);

router.get(
  "/google/callback",
  ((req: Request, res: Response, next: NextFunction) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }?error=oauth_not_configured`
      );
    }
    passport.authenticate("google", { failureRedirect: "/login" })(
      req,
      res,
      next
    );
  }) as any,
  (req, res) => {
    try {
      const user = req.user as IUser;
      if (!user) {
        return res.redirect(
          `${
            process.env.FRONTEND_URL || "http://localhost:3000"
          }?error=auth_failed`
        );
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET not configured");
      }

      const token = jwt.sign({ userId: user._id }, jwtSecret, {
        expiresIn: "7d",
      });

      // Redirect to frontend with token
      res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }?token=${token}&user=${encodeURIComponent(
          JSON.stringify(user.toJSON())
        )}`
      );
    } catch (error) {
      console.error("Google callback error:", error);
      res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }?error=auth_failed`
      );
    }
  }
);

// Check authentication status
router.get(
  "/check",
  authenticateToken as any,
  ((req: AuthRequest, res: Response) => {
    res.json({ authenticated: true, user: req.user });
  }) as any
);

export default router;
