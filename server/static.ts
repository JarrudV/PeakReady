import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Only fall through to index.html for SPA routes.
  // Missing asset files should return 404 instead of index.html (MIME mismatch).
  app.use("/{*path}", (req, res) => {
    if (path.extname(req.path)) {
      res.status(404).end();
      return;
    }

    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
