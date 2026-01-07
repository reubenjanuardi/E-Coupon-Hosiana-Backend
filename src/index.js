import app from "./app.js";
import { startReleaseExpiredOrdersJob } from "./jobs/releaseExpiredOrders.js";
import dotenv from "dotenv";

// Set timezone to UTC+7 (WIB - Waktu Indonesia Barat)
process.env.TZ = "Asia/Jakarta";

dotenv.config();
startReleaseExpiredOrdersJob();
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
