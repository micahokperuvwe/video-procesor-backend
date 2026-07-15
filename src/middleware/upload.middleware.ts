import multer, { MulterError } from 'multer';

// Configure multer for in-memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/webm',
      'video/mpeg',
    ];

    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpg'];

    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    const isMimeAllowed = allowedMimes.includes(file.mimetype);
    const isExtAllowed = allowedExtensions.includes(ext);

    if (isMimeAllowed && isExtAllowed) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
    }
  },
});

export const uploadSingle = upload.single('video');
export const uploadSingleVideo = upload.single('video');

export const handleUploadError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5GB limit' });
    }
    if (err.code === 'LIMIT_PART_COUNT') {
      return res.status(400).json({ error: 'Too many parts' });
    }
  }

  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }

  next();
};

export const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5GB limit' });
    }
  }
  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

export const validateFileUpload = (req: any, res: any, next: any) => {
  // Validation middleware - currently just passes through
  // Can be expanded to validate title, description, etc.
  next();
};
