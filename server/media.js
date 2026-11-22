"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { withDBLock } = require("./db");
const { fail, jsonResponse } = require("./security");
const directory =
  process.env.CRM_UPLOAD_DIR || path.join(__dirname, "../data/uploads");
async function handle(req, res, auth, db, pathname) {
  if (pathname === "/api/media" && req.method === "POST") {
    const limit = 50 * 1024 * 1024;
    const kind = new URL(req.url, "http://localhost").searchParams.get("kind");
    if (!["image", "video", "document"].includes(kind))
      fail("Dosya türü seçin.");
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > limit) fail("Dosya en fazla 50 MB olabilir.", 413);
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const hex = bytes.subarray(0, 12).toString("hex");
    let mime, extension;
    if (kind === "image" && hex.startsWith("ffd8ff")) {
      mime = "image/jpeg";
      extension = "jpg";
    } else if (kind === "image" && hex.startsWith("89504e470d0a1a0a")) {
      mime = "image/png";
      extension = "png";
    } else if (
      kind === "image" &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    ) {
      mime = "image/webp";
      extension = "webp";
    } else if (kind === "video" && bytes.toString("ascii", 4, 8) === "ftyp") {
      mime = "video/mp4";
      extension = "mp4";
    } else if (
      kind === "document" &&
      bytes.toString("ascii", 0, 5) === "%PDF-"
    ) {
      mime = "application/pdf";
      extension = "pdf";
    } else fail("JPEG, PNG, WebP fotoğraf, MP4 video veya PDF dosyası seçin.");
    const id = crypto.randomUUID() + "." + extension;
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(path.join(directory, id), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    try {
      await withDBLock((data, save) => {
        data.media ||= [];
        data.media.push({
          id,
          companyId: auth.companyId,
          userId: auth.user.id,
          kind,
          mime,
          size: length,
          createdAt: new Date().toISOString(),
        });
        save(data);
      });
    } catch (error) {
      await fs.promises.unlink(path.join(directory, id));
      throw error;
    }
    jsonResponse(res, 201, { url: "/api/media/" + id });
    return true;
  }
  if (pathname.startsWith("/api/media/") && req.method === "GET") {
    const id = pathname.slice("/api/media/".length);
    const media = (db.media || []).find(
      (m) => m.id === id && m.companyId === auth.companyId,
    );
    if (!media) fail("Dosya bulunamadı.", 404);
    const broker = ["owner", "admin", "secretary"].includes(
      auth.membership.role,
    );
    const accessible =
      broker ||
      media.userId === auth.user.id ||
      (db.properties || []).some(
        (p) =>
          p.companyId === auth.companyId &&
          (p.assignedToUserId || p.createdById) === auth.user.id &&
          [
            ...(p.images || []),
            ...(p.videos || []),
            ...(p.documents || []),
          ].includes(pathname),
      );
    if (!accessible) fail("Dosyaya erişim yetkiniz yok.", 403);
    const bytes = await fs.promises.readFile(path.join(directory, id));
    res.writeHead(200, {
      "Content-Type": media.mime,
      "Content-Length": bytes.length,
      "Cache-Control": "no-store",
      "Content-Disposition":
        media.kind === "document"
          ? 'attachment; filename="portfoy.pdf"'
          : "inline",
    });
    res.end(bytes);
    return true;
  }
  return false;
}
module.exports = { handle };
