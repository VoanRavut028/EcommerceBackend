import dotenv from "dotenv";
dotenv.config();
import app from "./app.ts";
import { connectDB } from "./configs/db.ts";

const PORT = process.env.PORT as string

const startServer = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(
      `Server is running in ${process.env.NODE_ENV} mode on http://localhost:${PORT}`,
    );
  });
};

startServer();
