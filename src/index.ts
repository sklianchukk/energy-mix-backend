// main express server entry point

import express, { Request, Response } from "express";
import cors from "cors";
import energyRoutes from "./routes/energyRoutes";

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// routes
app.use("/api", energyRoutes);

// health check
app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
});

// error handling middleware
app.use((err: Error, req: Request, res: Response) => {
    console.error("unhandled error:", err);
    res.status(500).json({
        error: "internal server error",
    });
});

app.listen(port, () => {
    console.log(`server running on port ${port}`);
});

export default app;
