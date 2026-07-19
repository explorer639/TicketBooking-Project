import mongoose, { Schema } from "mongoose";

const bookingSchema = new Schema(
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
        seats: [
            {
                type: Schema.Types.ObjectId,
                ref: "Seat",
                required: true,
            },
        ],
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled", "expired"],
            default: "pending",
            index: true,
        },
        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "paid", "failed", "refunded"],
            default: "pending",
        },
        // matches the seat lock window — booking auto-expires if unpaid
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

bookingSchema.index({ user: 1, createdAt: -1 });

export const Booking = mongoose.model("Booking", bookingSchema);
