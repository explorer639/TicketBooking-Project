import { Router } from "express";
import {
    joinWaitlist,
    getMyWaitlistEntries,
    leaveWaitlist,
} from "../controllers/waitlist.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// mounted at /waitlist
const router = Router();

router.use(verifyJWT); // every waitlist route requires a logged-in user

router.route("/my").get(getMyWaitlistEntries);
router.route("/:waitlistId").delete(leaveWaitlist);

// joining is scoped to a specific show: POST /waitlist/:showId/join
router.route("/:showId/join").post(joinWaitlist);

export default router;
