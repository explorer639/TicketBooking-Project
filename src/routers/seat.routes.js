import { Router } from "express";
import {
    getSeatsForShow,
    lockSeats,
    unlockSeats,
} from "../controllers/seat.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// mounted at /shows/:showId/seats — mergeParams gives access to :showId
const router = Router({ mergeParams: true });

router.route("/").get(getSeatsForShow);
router.route("/lock").post(verifyJWT, lockSeats);
router.route("/unlock").post(verifyJWT, unlockSeats);

export default router;
