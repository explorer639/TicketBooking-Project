import mongoose, { Schema } from "mongoose";

const eventSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        description: {
            type: String,
            required: true,
        },
        category: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        venue: {
            type: String,
            trim: true,
        },
        bannerImage: {
            type: String, // cloudinary/S3 URL
            default: "",
        },
        organizer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true, // used for soft-delete in event.controller.js
        },
    },
    { timestamps: true }
);

// speeds up the public listing query: { isActive: true, category, title regex }
eventSchema.index({ isActive: 1, category: 1 });

export const Event = mongoose.model("Event", eventSchema);
