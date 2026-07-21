import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRouter from "./routes/auth.routes.js";
import eventRouter from "./routes/event.routes.js";
import showRouter from "./routes/show.routes.js"; // nested creation routes
import showStandaloneRouter from "./routes/show.standalone.routes.js"; // /shows/:showId + seats
import bookingRouter from "./routes/booking.routes.js";
import waitlistRouter from "./routes/waitlist.routes.js";
import adminRouter from "./routes/admin.routes.js";

const app = express();

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/events", eventRouter);

// shows nested under events for creation/listing: /api/v1/events/:eventId/shows
app.use("/api/v1/events/:eventId/shows", showRouter);

// standalone show access + nested seats: /api/v1/shows/:showId, /api/v1/shows/:showId/seats
app.use("/api/v1/shows", showStandaloneRouter);

app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1/waitlist", waitlistRouter);
app.use("/api/v1/analytics", adminRouter);

// centralized error handler — catches every ApiError thrown in controllers
app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
        ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    });
});

export { app };
