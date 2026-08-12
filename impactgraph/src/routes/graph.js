import { Router } from "express";
import {
  getComponents,
  getComponent,
  getNeighborhood,
  getImpact,
  findPath,
  getStats
} from "../services/graphService.js";

const router = Router();

router.get("/stats", async (req, res, next) => {
  try {
    res.json(await getStats());
  } catch (error) {
    next(error);
  }
});

router.get("/components", async (req, res, next) => {
  try {
    res.json(await getComponents());
  } catch (error) {
    next(error);
  }
});

router.get("/components/:id", async (req, res, next) => {
  try {
    const component = await getComponent(req.params.id);
    if (!component) return res.status(404).json({ error: "Component not found" });
    res.json(component);
  } catch (error) {
    next(error);
  }
});

router.get("/components/:id/neighborhood", async (req, res, next) => {
  try {
    res.json(await getNeighborhood(req.params.id, req.query.depth));
  } catch (error) {
    next(error);
  }
});

router.get("/components/:id/impact", async (req, res, next) => {
  try {
    res.json(await getImpact(req.params.id, req.query.depth));
  } catch (error) {
    next(error);
  }
});

router.get("/path", async (req, res, next) => {
  try {
    const { source, target } = req.query;
    if (!source || !target) {
      return res.status(400).json({ error: "source and target are required" });
    }

    const graph = await findPath(source, target);
    if (!graph) return res.status(404).json({ error: "No dependency path found" });

    res.json(graph);
  } catch (error) {
    next(error);
  }
});

export default router;
