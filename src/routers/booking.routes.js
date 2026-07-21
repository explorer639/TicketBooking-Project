import { Router } from "express";
import {
    createBooking,
    payForBooking,
    cancelBooking,
    getMyBookings,
    getBookingById,
} from "../controllers/booking.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// routed to at /bookings
const router = Router();

router.use(verifyJWT); // every booking route requires a logged-in user

router.route("/").post(createBooking);
router.route("/my").get(getMyBookings);
router.route("/:bookingId").get(getBookingById);
router.route("/:bookingId/pay").post(payForBooking);
router.route("/:bookingId/cancel").post(cancelBooking);

export default router;
