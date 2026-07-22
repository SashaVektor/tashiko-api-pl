import express from "express";
import {
  getProductFeed,
  getProductsFeed,
  getProductsFeedByGroup,
  removeProductFeed,
  searchProductsFeed,
  getProductsFeedByGroupWithLimit,
  editProduct,
  getProductsByNumber,
  getProductsBrands,
  getProductCatalog,
  createProduct,
} from "../controllers/productFeedController.js";
import { isAdmin, isAuth } from "../utils.js";

const productFeedRoute = express.Router();

productFeedRoute.get("/", getProductsFeed);

productFeedRoute.get("/brands/get-brands", getProductsBrands);

productFeedRoute.get("/catalog/search", getProductCatalog);

productFeedRoute.get("/:productCode", getProductFeed);

productFeedRoute.get("/search-number/:number", getProductsByNumber);

productFeedRoute.delete("/:id", isAuth, isAdmin, removeProductFeed);

productFeedRoute.post("/", isAuth, isAdmin, createProduct);

productFeedRoute.patch("/", isAuth, isAdmin, editProduct);

productFeedRoute.get("/productFeed/:groupName", getProductsFeedByGroup);

productFeedRoute.get(
  "/productFeed/limit/:groupName",
  getProductsFeedByGroupWithLimit,
);

productFeedRoute.get("/search/productFeed", searchProductsFeed);

export default productFeedRoute;
