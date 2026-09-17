import fs from "fs";
import multer from "multer";
import path from "path";

/** Configuração única de uploads reutilizada por todas as rotas HTTP. */
export function createUploadMiddleware() {
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });

  return { uploadDir, upload: multer({ storage }) };
}
