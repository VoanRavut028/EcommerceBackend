import dotenv from "dotenv";
dotenv.config();
import app from "./app.ts";
import { connectDB } from "./configs/db.ts";
import { seedAdmin } from "./utils/seedAdmin.ts";
import { expireCheckoutReservations } from "./services/order.service.ts";
const PORT = process.env.PORT as string

const startServer = async (): Promise<void> => {
  await connectDB();
  await seedAdmin();  
  let expiryJobRunning = false;
  const runReservationExpiry = async () => {
    if (expiryJobRunning) return;
    expiryJobRunning = true;
    try {
      const expiredCount = await expireCheckoutReservations();
      if (expiredCount > 0) console.log(`Released ${expiredCount} expired checkout reservation(s)`);
    } catch (error) {
      console.error("Checkout reservation expiry job failed:", error);
    } finally {
      expiryJobRunning = false;
    }
  };
  await runReservationExpiry();
  const reservationExpiryTimer = setInterval(() => void runReservationExpiry(), 60_000);
  reservationExpiryTimer.unref();
  app.listen(PORT, () => {
    console.log(
      `Server is running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}`,
    );
  });
};

startServer();
