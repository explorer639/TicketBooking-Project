import { Event } from "../models/event.model.js";
import { Show } from "../models/show.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createEvent = asyncHandler(async (req, res) => {
    const { title, description, category, venue } = req.body;

    if ([title, description, category].some((field) => !field?.trim())) {
        throw new ApiError(400, "Title, description and category are required");
    }

    // assumes multer middleware attached req.file for banner upload,
    // and you have an uploadOnCloudinary(localPath) helper — swap this
    // out for however you handle file storage
    const bannerLocalPath = req.file?.path;
    let bannerImage = "";
    if (bannerLocalPath) {
        // const uploaded = await uploadOnCloudinary(bannerLocalPath);
        // bannerImage = uploaded?.url || "";
    }

    const event = await Event.create({
        title,
        description,
        category,
        venue,
        bannerImage,
        organizer: req.user._id,
        isActive: true,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, event, "Event created successfully"));
});

const getAllEvents = asyncHandler(async (req, res) => {
    const { category, search, page = 1, limit = 10 } = req.query;

    const filter = { isActive: true };
    if (category) filter.category = category;
    if (search) {
        filter.title = { $regex: search, $options: "i" };
    }

    const events = await Event.find(filter)
        .populate("organizer", "name email")
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

    const total = await Event.countDocuments(filter);

    return res.status(200).json(
        new ApiResponse(
            200,
            { events, total, page: Number(page), limit: Number(limit) },
            "Events fetched successfully"
        )
    );
});

const getEventById = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).populate(
        "organizer",
        "name email"
    );
    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    const shows = await Show.find({ event: eventId }).sort({ startTime: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, { event, shows }, "Event fetched successfully"));
});

const updateEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    if (event.organizer.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not allowed to edit this event");
    }

    const allowedUpdates = ["title", "description", "category", "venue"];
    allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
            event[field] = req.body[field];
        }
    });

    await event.save();

    return res
        .status(200)
        .json(new ApiResponse(200, event, "Event updated successfully"));
});

const deleteEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    if (
        event.organizer.toString() !== req.user._id.toString() &&
        req.user.role !== "admin"
    ) {
        throw new ApiError(403, "You are not allowed to delete this event");
    }

    // soft delete — keeps history for past bookings intact
    event.isActive = false;
    await event.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Event deleted successfully"));
});

export { createEvent, getAllEvents, getEventById, updateEvent, deleteEvent };
