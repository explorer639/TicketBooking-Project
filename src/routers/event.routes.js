import { Router } from "express";
import {
    createEvent,
    getAllEvents,
    getEventById,
    updateEvent,
    deleteEvent,
} from "../controllers/event.controller.js";
import { verifyJWT, verifyRole } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// public routes
router.route("/").get(getAllEvents);
router.route("/:eventId").get(getEventById);

// secured routes — organizer/admin only
router
    .route("/")
    .post(
        verifyJWT,
        verifyRole("organizer", "admin"),
        upload.single("bannerImage"),
        createEvent
    );

router
    .route("/:eventId")
    .patch(verifyJWT, verifyRole("organizer", "admin"), updateEvent)
    .delete(verifyJWT, verifyRole("organizer", "admin"), deleteEvent);

export default router;
