import mongoose from "mongoose";
import { Seat } from "../models/seat.model.js";
import { Show } from "../models/show.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes

const getSeatsForShow = asyncHandler(async (req, res) => {
    const { showId } = req.params;

    // lazily release any expired locks before returning current state
    await Seat.updateMany(
        { show: showId, status: "locked", lockExpiresAt: { $lt: new Date() } },
        { $set: { status: "available" }, $unset: { lockedBy: 1, lockExpiresAt: 1 } }
    );

    const seats = await Seat.find({ show: showId }).sort({ seatNumber: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, seats, "Seats fetched successfully"));
});

// Locks one or more seats for the requesting user.
// Uses an atomic per-seat findOneAndUpdate so two concurrent requests
// can never both "win" the same seat — this is the key interview point.
const lockSeats = asyncHandler(async (req, res) => {
    const { showId } = req.params;
    const { seatIds } = req.body;

    if (!Array.isArray(seatIds) || seatIds.length === 0) {
        throw new ApiError(400, "seatIds must be a non-empty array");
    }

    const show = await Show.findById(showId);
    if (!show) {
        throw new ApiError(404, "Show not found");
    }

    const lockExpiresAt = new Date(Date.now() + LOCK_DURATION_MS);
    const lockedSeats = [];
    const failedSeatIds = [];

    // Process sequentially so we can report exactly which seats failed.
    // Each update is atomic at the document level — Mongo guarantees
    // only one concurrent request can flip status "available" -> "locked".
    for (const seatId of seatIds) {
        const seat = await Seat.findOneAndUpdate(
            {
                _id: seatId,
                show: showId,
                $or: [
                    { status: "available" },
                    { status: "locked", lockExpiresAt: { $lt: new Date() } }, // reclaim expired lock
                ],
            },
            {
                $set: {
                    status: "locked",
                    lockedBy: req.user._id,
                    lockExpiresAt,
                },
            },
            { new: true }
        );

        if (seat) {
            lockedSeats.push(seat);
        } else {
            failedSeatIds.push(seatId);
        }
    }

    // if any seat couldn't be locked, roll back the ones we did lock
    // so the user doesn't end up holding a partial, confusing selection
    if (failedSeatIds.length > 0) {
        await Seat.updateMany(
            { _id: { $in: lockedSeats.map((s) => s._id) }, lockedBy: req.user._id },
            { $set: { status: "available" }, $unset: { lockedBy: 1, lockExpiresAt: 1 } }
        );

        throw new ApiError(
            409,
            `Seats already taken: ${failedSeatIds.join(", ")}`
        );
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            { seats: lockedSeats, lockExpiresAt },
            "Seats locked successfully. Complete payment before the lock expires."
        )
    );
});

// Explicit unlock — used when user changes selection or cancels before paying
const unlockSeats = asyncHandler(async (req, res) => {
    const { seatIds } = req.body;

    if (!Array.isArray(seatIds) || seatIds.length === 0) {
        throw new ApiError(400, "seatIds must be a non-empty array");
    }

    const result = await Seat.updateMany(
        { _id: { $in: seatIds }, lockedBy: req.user._id, status: "locked" },
        { $set: { status: "available" }, $unset: { lockedBy: 1, lockExpiresAt: 1 } }
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { modifiedCount: result.modifiedCount },
                "Seats unlocked successfully"
            )
        );
});

export { getSeatsForShow, lockSeats, unlockSeats };
