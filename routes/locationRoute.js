import express from "express"
import {isAdmin, isAuth} from "../utils.js"
import { createLocation, editLocation, getLocations, removeLocation } from "../controllers/locationController.js"

const locationRoute = express.Router()

locationRoute.get("/", getLocations)

locationRoute.delete("/:id", isAuth, isAdmin, removeLocation)

locationRoute.post("/", isAuth, isAdmin, createLocation)

locationRoute.patch("/:id", isAuth, isAdmin, editLocation)

export default locationRoute