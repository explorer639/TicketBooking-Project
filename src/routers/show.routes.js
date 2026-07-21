import { Router } from "express";
import { createShow, getShowsByEvent } from "../controllers/show.controller.js";
import { verifyJWT, verifyRole } from "../middlewares/auth.middleware.js";

// mounted at /events/:eventId/shows — mergeParams gives access to :eventId
const router = Router({ mergeParams: true });

router
    .route("/")
    .get(getShowsByEvent)
    .post(verifyJWT, verifyRole("organizer", "admin"), createShow);

export default router;
