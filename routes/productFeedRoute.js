import express from "express";
import multer from "multer";
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
  importProducts,
  exportProducts,
  downloadImportTemplate,
} from "../controllers/productFeedController.js";
import { isAdmin, isAuth } from "../utils.js";

const productFeedRoute = express.Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });
const uploadImportFile = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || "File upload failed" });
    next();
  });
};

productFeedRoute.get("/", getProductsFeed);

productFeedRoute.get("/brands/get-brands", getProductsBrands);

productFeedRoute.get("/catalog/search", getProductCatalog);

productFeedRoute.get("/export", isAuth, isAdmin, exportProducts);

productFeedRoute.get("/import-template", isAuth, isAdmin, downloadImportTemplate);

productFeedRoute.post(
  "/import",
  isAuth,
  isAdmin,
  uploadImportFile,
  importProducts,
);

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
