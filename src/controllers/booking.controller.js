import mongoose from "mongoose";
import { Booking } from "../models/booking.model.js";
import { Seat } from "../models/seat.model.js";
import { Show } from "../models/show.model.js";
import { Payment } from "../models/payment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { processWaitlistForShow } from "./waitlist.controller.js";

const BOOKING_EXPIRY_MS = 10 * 60 * 1000; // matches seat lock duration

// Creates a "pending" booking from seats the user has already locked.
// Wrapped in a transaction so the booking + seat-ownership check
// happen atomically — if anything fails, nothing is half-committed.
const createBooking = asyncHandler(async (req, res) => {
    const { showId, seatIds } = req.body;

    if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
        throw new ApiError(400, "showId and seatIds are required");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const show = await Show.findById(showId).session(session);
        if (!show) throw new ApiError(404, "Show not found");

        const seats = await Seat.find({
            _id: { $in: seatIds },
            show: showId,
        }).session(session);

        if (seats.length !== seatIds.length) {
            throw new ApiError(400, "One or more seats do not belong to this show");
        }

        const invalidSeat = seats.find(
            (seat) =>
                seat.status !== "locked" ||
                seat.lockedBy?.toString() !== req.user._id.toString() ||
                seat.lockExpiresAt < new Date()
        );
        if (invalidSeat) {
            throw new ApiError(
                409,
                `Seat ${invalidSeat.seatNumber} is not locked by you or the lock has expired`
            );
        }

        const totalAmount = seats.reduce((sum, seat) => {
            const price = show.pricePerCategory?.[seat.category] || 0;
            return sum + price;
        }, 0);

        const expiresAt = new Date(Date.now() + BOOKING_EXPIRY_MS);

        const booking = await Booking.create(
            [
                {
                    user: req.user._id,
                    show: showId,
                    seats: seatIds,
                    status: "pending",
                    totalAmount,
                    paymentStatus: "pending",
                    expiresAt,
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res
            .status(201)
            .json(
                new ApiResponse(
                    201,
                    booking[0],
                    "Booking created. Complete payment before it expires."
                )
            );
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error instanceof ApiError
            ? error
            : new ApiError(500, "Failed to create booking", [error.message]);
    }
});

// Mock payment gateway callback. In a real system this would be a
// webhook from Stripe/Razorpay etc; here we simulate success/failure.
const payForBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    if (booking.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "This booking does not belong to you");
    }

    if (booking.status !== "pending") {
        throw new ApiError(400, `Booking is already ${booking.status}`);
    }

    if (booking.expiresAt < new Date()) {
        booking.status = "expired";
        await booking.save();
        await Seat.updateMany(
            { _id: { $in: booking.seats } },
            { $set: { status: "available" }, $unset: { lockedBy: 1, lockExpiresAt: 1 } }
        );
        throw new ApiError(410, "Booking expired before payment was completed");
    }

    // simulate a payment gateway — 90% success rate
    const isPaymentSuccessful = Math.random() < 0.9;
    const transactionId = `MOCK_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    const payment = await Payment.create({
        booking: booking._id,
        amount: booking.totalAmount,
        status: isPaymentSuccessful ? "paid" : "failed",
        transactionId,
        paidAt: isPaymentSuccessful ? new Date() : null,
    });

    if (isPaymentSuccessful) {
        booking.status = "confirmed";
        booking.paymentStatus = "paid";
        await booking.save();

        await Seat.updateMany(
            { _id: { $in: booking.seats } },
            { $set: { status: "booked" }, $unset: { lockedBy: 1, lockExpiresAt: 1 } }
        );

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { booking, payment },
                    "Payment successful, booking confirmed"
                )
            );
    } else {
        booking.paymentStatus = "failed";
        await booking.save();
        // seats stay locked until natural expiry so the user can retry payment
        return res
            .status(402)
            .json(new ApiResponse(402, { booking, payment }, "Payment failed"));
    }
});

const cancelBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    if (booking.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "This booking does not belong to you");
    }

    if (booking.status === "cancelled") {
        throw new ApiError(400, "Booking is already cancelled");
    }

    const wasConfirmed = booking.status === "confirmed";

    booking.status = "cancelled";
    if (wasConfirmed) booking.paymentStatus = "refunded";
    await booking.save();

    await Seat.updateMany(
        { _id: { $in: booking.seats } },
        { $set: { status: "available" }, $unset: { lockedBy: 1, lockExpiresAt: 1 } }
    );

    // a seat just freed up — check if anyone on the waitlist can claim it
    await processWaitlistForShow(booking.show);

    return res
        .status(200)
        .json(new ApiResponse(200, booking, "Booking cancelled successfully"));
});

const getMyBookings = asyncHandler(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate("show")
        .populate("seats")
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, bookings, "Bookings fetched successfully"));
});

const getBookingById = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate("show")
        .populate("seats");

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    if (
        booking.user.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
    ) {
        throw new ApiError(403, "You are not allowed to view this booking");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, booking, "Booking fetched successfully"));
});

export {
    createBooking,
    payForBooking,
    cancelBooking,
    getMyBookings,
    getBookingById,
};
