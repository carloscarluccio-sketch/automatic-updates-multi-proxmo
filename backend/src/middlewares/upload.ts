import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../uploads');
const logosDir = path.join(uploadDir, 'logos');
const faviconsDir = path.join(uploadDir, 'favicons');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

if (!fs.existsSync(faviconsDir)) {
  fs.mkdirSync(faviconsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, logosDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = 'logo_' + Date.now() + ext;
    cb(null, filename);
  }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(ext);

  if (mimeType && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpg, png, gif, svg, webp)'));
  }
};

export const uploadLogo = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
}).single('logo');

// Favicon upload configuration
const faviconStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, faviconsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = 'favicon_' + Date.now() + ext;
    cb(null, filename);
  }
});

const faviconFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /ico|png/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const mimeType = file.mimetype === 'image/x-icon' || file.mimetype === 'image/png';
  const extname = allowedTypes.test(ext);

  if (mimeType && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only .ico and .png files are allowed for favicons'));
  }
};

export const uploadFavicon = multer({
  storage: faviconStorage,
  fileFilter: faviconFileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024 // 1MB limit for favicons
  }
}).single('favicon');


export const handleUploadError = (err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Upload error: ' + err.message
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};
