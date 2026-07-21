import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
        cb(null, "./public/temp"); // temp local folder, cleared after cloud upload
    },
    filename: function (_req, file, cb) {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
