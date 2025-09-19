import express from "express"
import {isAdmin, isAuth} from "../utils.js"
import { createCategory, editCategory, getCategories, getFilteredCategories, removeCaterory } from "../controllers/CategoryController.js"

const categoryRoute = express.Router()

categoryRoute.get("/", getCategories)

categoryRoute.get("/filteded-cateroty", getFilteredCategories)

categoryRoute.delete("/:id", isAuth, isAdmin, removeCaterory)

categoryRoute.post("/", isAuth, isAdmin, createCategory)

categoryRoute.patch("/:id", isAuth, isAdmin, editCategory)

export default categoryRoute