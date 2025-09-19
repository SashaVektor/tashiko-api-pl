import express from "express"
import { createUserGarage, getUserGarage, removeUserGarage } from "../controllers/userGarageController.js"

const userGarageRoute = express.Router()

userGarageRoute.get("/:id", getUserGarage)

userGarageRoute.delete("/:id", removeUserGarage)

userGarageRoute.post("/", createUserGarage)


export default userGarageRoute