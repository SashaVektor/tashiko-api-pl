import express from "express"
import {isAdmin, isAuth} from "../utils.js"
import { editDollarRate, getDollarRate } from "../controllers/dollarRateController.js"

const dollarRateRoute = express.Router()

dollarRateRoute.get("/", getDollarRate)

dollarRateRoute.patch("/", isAuth, isAdmin, editDollarRate)

export default dollarRateRoute