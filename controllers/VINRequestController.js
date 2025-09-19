import expressAsyncHandler from "express-async-handler";
import VINRequest from "../models/VINRequest.js";

export const getVIN = expressAsyncHandler(async (req, res) => {
  try {
    const vins = await VINRequest.find();
    res.send(vins);
  } catch (err) {
    res.status(401).send({ message: "Что-то пошло не так!" });
  }
});

export const getUserVIN = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    const userVIN = await VINRequest.find({userId: id});

    if (!userVIN) {
      res.status(401).send({ message: "Вин кодов не найдено!" });
    } else {
      res.send(userVIN);
    }
  } catch (err) {
    res.status(401).send({ message: "Что-то пошло не так!" });
  }
});

export const createVIN = expressAsyncHandler(async (req, res) => {
  try {
    const vin = req.body;
    const newVIN = new VINRequest({
        phone: vin.phone,
        vin: vin.vin || "",
        text: vin.text,
        userId: vin.userId,
        photo: vin.photo || "",
    });
    const prod = await newVIN.save();
    if (prod) {
      res.status(200).send({ message: "Запрос успешно отправлен!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const editVin = expressAsyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const vin = await VINRequest.findById(id);
      const status = vin.status === "Не обработан" ? "Обработан" : "Не обработан";
      
      if (vin) {
        vin.status = status;
  
        const updatedVin = await vin.save();
  
        if (!updatedVin) {
          res.status(403).send({ message: "Что-то пошло не так!" });
          return;
        }
  
        res.status(200).send({ message: "Статус запроса обновлён!" });
      } else {
        return res.status(404).send({ message: "Категория не найдена!" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "INTERNAL SERVER ERROR" });
    }
  });
  
  export const removeVIN = expressAsyncHandler(async (req, res) => {
    try {
      const vin = await VINRequest.findById(req.params.id);
      if (vin) {
        await vin.deleteOne();
        res.send({ message: "Запрос успешно удалён!" });
      } else {
        res.status(404).send({ message: "Запрос не найден!" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "INTERNAL SERVER ERROR" });
    }
  });