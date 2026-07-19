import mongoose, { Schema } from "mongoose";

// One section of the seat map, e.g. { category: "VIP", rows: 2, seatsPerRow: 10, price: 1500 }
const seatSectionSchema = new Schema(
    {
        category: { type: String, required: true, trim: true },
        rows: { type: Number, required: true, min: 1 },
        seatsPerRow: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const showSchema = new Schema(
    {
        event: {
            type: Schema.Types.ObjectId,
            ref: "Event",
            required: true,
            index: true,
        },
        startTime: {
            type: Date,
            required: true,
        },
        venue: {
            type: String,
            trim: true,
        },
        totalSeats: {
            type: Number,
            required: true,
            min: 0,
        },
        // raw layout definition used to generate individual Seat documents
        seatMap: {
            sections: {
                type: [seatSectionSchema],
                required: true,
                validate: {
                    validator: (arr) => Array.isArray(arr) && arr.length > 0,
                    message: "seatMap.sections must have at least one section",
                },
            },
        },
        // quick lookup for pricing without joining seatMap.sections,
        // e.g. { VIP: 1500, Regular: 500 } — used in booking.controller.js
        // to calculate totalAmount and in admin.controller.js for revenue.
        // Plain object (not Mongoose Map) so bracket notation like
        // show.pricePerCategory[category] works directly in controllers.
        pricePerCategory: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

showSchema.index({ event: 1, startTime: 1 });

export const Show = mongoose.model("Show", showSchema);
