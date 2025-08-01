import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User, IUser } from "../models/User";

export const configurePassport = () => {
  // Only configure Google OAuth if credentials are provided
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    console.log("🔐 Configuring Google OAuth strategy...");

    // Google OAuth Strategy
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: "/api/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Check if user already exists with this Google ID
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
              // Update last login
              user.lastLogin = new Date();
              await user.save();
              return done(null, user);
            }

            // Check if user exists with same email
            user = await User.findOne({ email: profile.emails?.[0]?.value });

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
            const newUser = new User({
              googleId: profile.id,
              name:
                profile.displayName ||
                profile.name?.givenName + " " + profile.name?.familyName ||
                "Google User",
              email: profile.emails?.[0]?.value || "",
              avatar: profile.photos?.[0]?.value || null,
            });

            await newUser.save();
            return done(null, newUser);
          } catch (error) {
            console.error("Google OAuth error:", error);
            return done(error as Error, false);
          }
        }
      )
    );
  } else {
    console.log(
      "⚠️  Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable"
    );
  }

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id).select("-password");
      done(null, user);
    } catch (error) {
      done(error as Error, false);
    }
  });
};
