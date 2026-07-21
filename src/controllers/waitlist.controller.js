import { Waitlist } from "../models/waitlist.model.js";
import { Seat } from "../models/seat.model.js";
import { Show } from "../models/show.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const CLAIM_WINDOW_MS = 5 * 60 * 1000; // time a notified user has to book

const joinWaitlist = asyncHandler(async (req, res) => {
    const { showId } = req.params;
    const { seatsRequested = 1 } = req.body;

    const show = await Show.findById(showId);
    if (!show) {
        throw new ApiError(404, "Show not found");
    }

    const availableCount = await Seat.countDocuments({
        show: showId,
        status: "available",
    });

    if (availableCount >= seatsRequested) {
        throw new ApiError(
            400,
            "Seats are currently available — no need to join the waitlist"
        );
    }

    const existingEntry = await Waitlist.findOne({
        show: showId,
        user: req.user._id,
        status: "waiting",
    });
    if (existingEntry) {
        throw new ApiError(409, "You are already on the waitlist for this show");
    }

    const entry = await Waitlist.create({
        user: req.user._id,
        show: showId,
        seatsRequested,
        status: "waiting",
        joinedAt: new Date(),
    });

    return res
        .status(201)
        .json(new ApiResponse(201, entry, "Added to waitlist successfully"));
});

const getMyWaitlistEntries = asyncHandler(async (req, res) => {
    const entries = await Waitlist.find({ user: req.user._id })
        .populate("show")
        .sort({ joinedAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, entries, "Waitlist entries fetched"));
});

const leaveWaitlist = asyncHandler(async (req, res) => {
    const { waitlistId } = req.params;

    const entry = await Waitlist.findById(waitlistId);
    if (!entry) {
        throw new ApiError(404, "Waitlist entry not found");
    }
    if (entry.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "This waitlist entry does not belong to you");
    }

    await entry.deleteOne();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Removed from waitlist"));
});

// Core waitlist matching logic — called whenever seats free up
// (booking cancelled/expired). FIFO by joinedAt: the longest-waiting
// user who can be satisfied by the currently available seat count
// gets notified first.
//
// In production this would be pushed onto a job queue (e.g. BullMQ)
// and the "notify" step would send a real email/push notification.
// Kept synchronous here to keep the project dependency-light.
const processWaitlistForShow = async (showId) => {
    const availableCount = await Seat.countDocuments({
        show: showId,
        status: "available",
    });

    if (availableCount === 0) return;

    const waitingEntries = await Waitlist.find({
        show: showId,
        status: "waiting",
    }).sort({ joinedAt: 1 });

    for (const entry of waitingEntries) {
        if (entry.seatsRequested <= availableCount) {
            entry.status = "notified";
            entry.notifiedAt = new Date();
            entry.claimExpiresAt = new Date(Date.now() + CLAIM_WINDOW_MS);
            await entry.save();

            // TODO: send actual notification via nodemailer / push service
            console.log(
                `[waitlist] notified user ${entry.user} — ${entry.seatsRequested} seat(s) available for show ${showId}`
            );

            // only notify the single next-in-line entry per free-up event;
            // if they don't claim in time, a later expiry sweep (cron) can
            // re-run this function to notify the next person
            break;
        }
    }
};

// Sweep job (call from node-cron): expires stale "notified" entries
// whose claim window has passed, then re-checks the waitlist for the
// next person in line.
const sweepExpiredWaitlistClaims = asyncHandler(async (_req, res) => {
    const expired = await Waitlist.find({
        status: "notified",
        claimExpiresAt: { $lt: new Date() },
    });

    const affectedShows = new Set();

    for (const entry of expired) {
        entry.status = "expired";
        await entry.save();
        affectedShows.add(entry.show.toString());
    }

    for (const showId of affectedShows) {
        await processWaitlistForShow(showId);
    }

    return res
        ? res
              .status(200)
              .json(
                  new ApiResponse(
                      200,
                      { expiredCount: expired.length },
                      "Waitlist sweep complete"
                  )
              )
        : null;
});

export {
    joinWaitlist,
    getMyWaitlistEntries,
    leaveWaitlist,
    processWaitlistForShow,
    sweepExpiredWaitlistClaims,
};
