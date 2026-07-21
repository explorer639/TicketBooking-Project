import { Router } from "express";
import {
    getEventAnalytics,
    getTopEvents,
    getMonthlyRevenue,
} from "../controllers/admin.controller.js";
import { verifyJWT, verifyRole } from "../middlewares/auth.middleware.js";

// mounted at /analytics
const router = Router();

router.use(verifyJWT);

// organizer can see their own event's analytics (ownership checked in controller)
router.route("/events/:eventId").get(verifyRole("organizer", "admin"), getEventAnalytics);

// platform-wide analytics — admin only
router.route("/top-events").get(verifyRole("admin"), getTopEvents);
router.route("/monthly-revenue").get(verifyRole("admin"), getMonthlyRevenue);

export default router;
