import express from "express";
import {
  createProduct,
  listProducts,
} from "../controllers/product.controller.ts";

const productRoute = express.Router();

productRoute.post("/products", createProduct);
productRoute.get("/products", listProducts);
export default productRoute;
