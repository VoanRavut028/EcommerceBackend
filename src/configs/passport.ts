import dotenv from "dotenv";
dotenv.config();
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/user.model.ts";

function parseUserName(displayName?: string, username?: string) {
  const fullName = displayName || username || "Unknown User";
  const parts = fullName.trim().split(/\s+/);
  return {
    first_name: parts.shift() || "Unknown",
    last_name: parts.join(" ") || "User",
  };
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
      scope: ["openid", "profile", "email"],
    },
    async (profile: any, done: any) => {
      try {
        let user = await User.findOne({
          socialId: profile.id,
          provider: "google",
        });
        if (user) return done(null, user);

        const email = profile.emails?.[0]?.value;
        if (email) {
          user = await User.findOne({ email });
          if (user) {
            user.socialId = profile.id;
            user.provider = "google";
            if (!user.avatar_url)
              user.avatar_url = profile.photos?.[0]?.value ?? null;
            await user.save({ validateBeforeSave: false });
            return done(null, user);
          }
        }

        const { first_name, last_name } = parseUserName(profile.displayName);

        user = await User.create({
          first_name,
          last_name,
          email: email,
          avatar_url: profile.photos?.[0]?.value ?? null,
          socialId: profile.id,
          provider: "google",
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      callbackURL: process.env.GITHUB_CALLBACK_URL as string,
      scope: ["user:email"],
    },
    async (profile: any, done: any) => {
      try {
        let user = await User.findOne({
          socialId: profile.id,
          provider: "github",
        });
        if (user) return done(null, user);

        const email = profile.emails?.[0]?.value;
        if (email) {
          user = await User.findOne({ email });
          if (user) {
            user.socialId = profile.id;
            user.provider = "github";
            if (!user.avatar_url)
              user.avatar_url = profile.photos?.[0]?.value ?? null;
            await user.save({ validateBeforeSave: false });
            return done(null, user);
          }
        }

        const { first_name, last_name } = parseUserName(
          profile.displayName,
          profile.username,
        );

        user = await User.create({
          first_name,
          last_name,
          email: email,
          avatar_url: profile.photos?.[0]?.value ?? null,
          socialId: profile.id,
          provider: "github",
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

export default passport;
