import mongoose, { Schema } from "mongoose";

const waitlistSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        show: {
            type: Schema.Types.ObjectId,
            ref: "Show",
            required: true,
            index: true,
        },
        seatsRequested: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
        },
        status: {
            type: String,
            enum: ["waiting", "notified", "expired"],
            default: "waiting",
            index: true,
        },
        joinedAt: {
            type: Date,
            default: Date.now,
        },
        notifiedAt: {
            type: Date,
            default: null,
        },
        // window the notified user has to complete a booking
        // before the next person in line gets a turn
        claimExpiresAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// FIFO ordering query: { show, status: "waiting" } sorted by joinedAt
waitlistSchema.index({ show: 1, status: 1, joinedAt: 1 });

// prevent a user from joining the same show's waitlist twice while still waiting
waitlistSchema.index(
    { show: 1, user: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: "waiting" } }
);

export const Waitlist = mongoose.model("Waitlist", waitlistSchema);
