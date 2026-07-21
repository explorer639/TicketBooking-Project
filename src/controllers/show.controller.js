import { Event } from "../models/event.model.js";
import { Show } from "../models/show.model.js";
import { Seat } from "../models/seat.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const createShow = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const { startTime, venue, seatMap } = req.body;

    if (!startTime || !seatMap?.sections?.length) {
        throw new ApiError(400, "startTime and seatMap.sections are required");
    }

    const event = await Event.findById(eventId);
    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    if (event.organizer.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to add shows to this event");
    }

    let totalSeats = 0;
    const pricePerCategory = {};
    seatMap.sections.forEach((section) => {
        totalSeats += section.rows * section.seatsPerRow;
        pricePerCategory[section.category] = section.price;
    });

    const show = await Show.create({
        event: eventId,
        startTime,
        venue: venue || event.venue,
        totalSeats,
        seatMap,
        pricePerCategory,
    });

    // generate individual seat documents so each seat can be
    // locked/booked independently
    const seatDocs = [];
    seatMap.sections.forEach((section) => {
        for (let row = 1; row <= section.rows; row++) {
            for (let num = 1; num <= section.seatsPerRow; num++) {
                seatDocs.push({
                    show: show._id,
                    seatNumber: `${section.category[0]}${row}-${num}`,
                    category: section.category,
                    status: "available",
                });
            }
        }
    });

    await Seat.insertMany(seatDocs);

    return res
        .status(201)
        .json(new ApiResponse(201, show, "Show created with seats generated"));
});

const getShowsByEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    const shows = await Show.find({ event: eventId }).sort({ startTime: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, shows, "Shows fetched successfully"));
});

const getShowById = asyncHandler(async (req, res) => {
    const { showId } = req.params;

    const show = await Show.findById(showId).populate("event", "title venue");
    if (!show) {
        throw new ApiError(404, "Show not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, show, "Show fetched successfully"));
});

const deleteShow = asyncHandler(async (req, res) => {
    const { showId } = req.params;

    const show = await Show.findById(showId).populate("event");
    if (!show) {
        throw new ApiError(404, "Show not found");
    }

    if (show.event.organizer.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to delete this show");
    }

    await Seat.deleteMany({ show: showId });
    await show.deleteOne();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Show and its seats deleted"));
});

export { createShow, getShowsByEvent, getShowById, deleteShow };
