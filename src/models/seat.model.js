import mongoose, { Schema } from "mongoose";

const seatSchema = new Schema(
    {
        show: {
            type: Schema.Types.ObjectId,
            ref: "Show",
            required: true,
            index: true,
        },
        seatNumber: {
            type: String,
            required: true, // e.g. "V1-3", "R2-15"
        },
        category: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ["available", "locked", "booked"],
            default: "available",
            index: true,
        },
        lockedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        lockExpiresAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// a seat number must be unique within a given show
seatSchema.index({ show: 1, seatNumber: 1 }, { unique: true });

// speeds up the lock query's $or clause (status + lockExpiresAt check)
seatSchema.index({ show: 1, status: 1, lockExpiresAt: 1 });

export const Seat = mongoose.model("Seat", seatSchema);
