import express from "express";
import {
  createCategoryController,
  listCategories,
} from "../controllers/category.controller.ts";

const categoryRouter = express.Router();

categoryRouter.post("/categories", createCategoryController);
categoryRouter.get("/categories", listCategories);
export default categoryRouter;
