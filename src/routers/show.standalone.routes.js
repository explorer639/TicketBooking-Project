import { Router } from "express";
import { getShowById, deleteShow } from "../controllers/show.controller.js";
import { verifyJWT, verifyRole } from "../middlewares/auth.middleware.js";
import seatRouter from "./seat.routes.js";

// mounted at /shows
const router = Router();

router.route("/:showId").get(getShowById);
router
    .route("/:showId")
    .delete(verifyJWT, verifyRole("organizer", "admin"), deleteShow);

// nest seat routes: /shows/:showId/seats/...
router.use("/:showId/seats", seatRouter);

export default router;
