import User from "../models/user.model.ts";
import { hashPassword } from "../utils/passwordValidator.ts"; // adjust path if needed

export const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const firstName = process.env.ADMIN_FIRST_NAME || "Admin";
    const lastName = process.env.ADMIN_LAST_NAME || "User";

    if (!adminEmail || !adminPassword) {
      console.log("⚠️  ADMIN_EMAIL or ADMIN_PASSWORD missing in .env — skipping admin seed");
      return;
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      console.log("✅ Admin already exists — skipping seed");
      return;
    }

    // Hash the password from .env
    const hashedPassword = await hashPassword(adminPassword);

    // Create the single admin
    await User.create({
      first_name: firstName,
      last_name: lastName,
      email: adminEmail.toLowerCase().trim(),
      password: hashedPassword,
      role: "admin",
      provider: "local",
     
    });

    console.log("✅ Admin account created successfully from .env");
  } catch (error) {
    console.error("❌ Failed to seed admin:", error);
  }
};