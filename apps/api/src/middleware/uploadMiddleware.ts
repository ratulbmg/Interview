import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { apiError } from "../utils/apiError";

// Stored on local disk under the api workspace, served back out via
// Express.static in app.ts. `process.cwd()` is the apps/api workspace root
// in both dev (nodemon) and prod (`yarn workspace api start`).
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const uploader = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new apiError("Only PDF files are allowed for a CV", 400));
      return;
    }
    cb(null, true);
  },
}).single("cv");

// Wraps multer's callback-style errors (e.g. LIMIT_FILE_SIZE) as apiError
// instances so they get the same JSON shape as every other validation
// failure, instead of falling through errorMiddleware's generic 500 branch.
export const uploadCv = (req: Request, res: Response, next: NextFunction) => {
  uploader(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      next(new apiError(err.message, 400));
      return;
    }
    next(err);
  });
};
