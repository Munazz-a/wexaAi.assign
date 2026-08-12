import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import graphRouter from "./routes/graph.js";
import { verifyDatabase, closeDatabase } from "./db.js";
import { config } from "./config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", async (req, res) => {
  try {
    await verifyDatabase();
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({
      status: "error",
      database: "unavailable",
      message: "CognoDB is currently unreachable."
    });
  }
});

app.use("/api/graph", graphRouter);

app.use("/api/*splat", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(503).json({
    error: "Graph database unavailable",
    message: "ImpactGraph could not complete that request. Check the CognoDB connection."
  });
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const server = app.listen(config.port, () => {
  console.log(`ImpactGraph running at http://localhost:${config.port}`);
});

process.on("SIGINT", async () => {
  server.close();
  await closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  server.close();
  await closeDatabase();
  process.exit(0);
});
