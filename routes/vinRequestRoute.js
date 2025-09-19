import express from "express"
import { createVIN, editVin, getUserVIN, getVIN, removeVIN } from "../controllers/VINRequestController.js"
import { isAdmin, isAuth } from "../utils.js"

const vinRoute = express.Router()

vinRoute.get("/",  getVIN)

vinRoute.get("/user-vins/:id", getUserVIN)

vinRoute.post("/", createVIN)

vinRoute.delete("/:id", isAuth, isAdmin, removeVIN)

vinRoute.patch("/:id", isAuth, isAdmin, editVin)


export default vinRoute