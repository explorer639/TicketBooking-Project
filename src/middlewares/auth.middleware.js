import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

// Verifies access token from cookie or Authorization header, attaches req.user
export const verifyJWT = asyncHandler(async (req, _res, next) => {
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(401, "Invalid or expired access token");
    }

    const user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken"
    );

    if (!user) {
        throw new ApiError(401, "Invalid access token — user not found");
    }

    req.user = user;
    next();
});

// Restricts route to specific roles, e.g. verifyRole("organizer", "admin")
export const verifyRole = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized request");
        }
        if (!allowedRoles.includes(req.user.role)) {
            throw new ApiError(
                403,
                `Role '${req.user.role}' is not allowed to access this resource`
            );
        }
        next();
    };
};
