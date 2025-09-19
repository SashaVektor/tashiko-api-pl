import expressAsyncHandler from "express-async-handler";
import UserGarage from "../models/UserGarage.js";

export const getUserGarage = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const userGarage = await UserGarage.find({ userId: id });
    res.send(userGarage);
  } catch (err) {
    res.status(401).send({ message: "Что-то пошло не так!" });
  }
});

export const createUserGarage = expressAsyncHandler(async (req, res) => {
  try {
    const garage = req.body;
    const newGarage = new UserGarage({
      selectedBrand: garage.selectedBrand,
      selectedMark: garage.selectedMark,
      selectedYear: garage.selectedYear,
      userId: garage.userId,
    });
    const prod = await newGarage.save();
    if (prod) {
      res.status(200).send({ message: "Машина успешно добавлена!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const removeUserGarage = expressAsyncHandler(async (req, res) => {
  try {
    const garage = await UserGarage.findById(req.params.id);
    if (garage) {
      await garage.deleteOne();
      res.send({ message: "Машина удалена успешно!" });
    } else {
      res.status(404).send({ message: "Машина не найдена!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});
