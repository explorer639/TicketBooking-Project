import mongoose from "mongoose";
import { Booking } from "../models/booking.model.js";
import { Seat } from "../models/seat.model.js";
import { Show } from "../models/show.model.js";
import { Event } from "../models/event.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Revenue + booking count per event, for an organizer's own events (or all events if admin).
const getEventAnalytics = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    if (
        event.organizer.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
    ) {
        throw new ApiError(403, "You are not allowed to view this analytics");
    }

    const analytics = await Show.aggregate([
        { $match: { event: new mongoose.Types.ObjectId(eventId) } },
        {
            $lookup: {
                from: "bookings",
                localField: "_id",
                foreignField: "show",
                as: "bookings",
            },
        },
        {
            $addFields: {
                confirmedBookings: {
                    $filter: {
                        input: "$bookings",
                        as: "b",
                        cond: { $eq: ["$$b.status", "confirmed"] },
                    },
                },
            },
        },
        {
            $project: {
                startTime: 1,
                venue: 1,
                totalSeats: 1,
                confirmedBookingCount: { $size: "$confirmedBookings" },
                revenue: { $sum: "$confirmedBookings.totalAmount" },
            },
        },
        {
            $lookup: {
                from: "seats",
                localField: "_id",
                foreignField: "show",
                as: "seats",
            },
        },
        {
            $addFields: {
                bookedSeatCount: {
                    $size: {
                        $filter: {
                            input: "$seats",
                            as: "s",
                            cond: { $eq: ["$$s.status", "booked"] },
                        },
                    },
                },
            },
        },
        {
            $addFields: {
                occupancyRate: {
                    $cond: [
                        { $eq: ["$totalSeats", 0] },
                        0,
                        {
                            $round: [
                                { $multiply: [{ $divide: ["$bookedSeatCount", "$totalSeats"] }, 100] },
                                2,
                            ],
                        },
                    ],
                },
            },
        },
        { $project: { seats: 0 } },
        { $sort: { startTime: 1 } },
    ]);

    const totalRevenue = analytics.reduce((sum, show) => sum + (show.revenue || 0), 0);

    return res.status(200).json(
        new ApiResponse(
            200,
            { event: event.title, totalRevenue, shows: analytics },
            "Event analytics fetched successfully"
        )
    );
});

// Most-booked events across the platform (admin dashboard widget)
const getTopEvents = asyncHandler(async (req, res) => {
    const { limit = 5 } = req.query;

    const topEvents = await Booking.aggregate([
        { $match: { status: "confirmed" } },
        {
            $lookup: {
                from: "shows",
                localField: "show",
                foreignField: "_id",
                as: "showDetails",
            },
        },
        { $unwind: "$showDetails" },
        {
            $group: {
                _id: "$showDetails.event",
                totalBookings: { $sum: 1 },
                totalRevenue: { $sum: "$totalAmount" },
            },
        },
        { $sort: { totalBookings: -1 } },
        { $limit: Number(limit) },
        {
            $lookup: {
                from: "events",
                localField: "_id",
                foreignField: "_id",
                as: "eventDetails",
            },
        },
        { $unwind: "$eventDetails" },
        {
            $project: {
                _id: 0,
                eventId: "$eventDetails._id",
                title: "$eventDetails.title",
                category: "$eventDetails.category",
                totalBookings: 1,
                totalRevenue: 1,
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, topEvents, "Top events fetched successfully"));
});

// Monthly revenue trend across the whole platform — good for an admin chart
const getMonthlyRevenue = asyncHandler(async (_req, res) => {
    const monthlyRevenue = await Booking.aggregate([
        { $match: { status: "confirmed" } },
        {
            $group: {
                _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                },
                revenue: { $sum: "$totalAmount" },
                bookingCount: { $sum: 1 },
            },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
            $project: {
                _id: 0,
                year: "$_id.year",
                month: "$_id.month",
                revenue: 1,
                bookingCount: 1,
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, monthlyRevenue, "Monthly revenue fetched"));
});

export { getEventAnalytics, getTopEvents, getMonthlyRevenue };
