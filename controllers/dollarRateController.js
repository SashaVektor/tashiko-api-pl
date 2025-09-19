import expressAsyncHandler from "express-async-handler";
import DollarRate from "../models/dollarRate.js";

export const getDollarRate = expressAsyncHandler(async (req, res) => {
  try {
    const dollarRate = await DollarRate.find();
    res.send(dollarRate);
  } catch (err) {
    res.status(401).send({ message: "Что-то пошло не так!" });
  }
});

export const editDollarRate = expressAsyncHandler(async (req, res) => {
    try {
      const dollarRate = await DollarRate.findOne();
  
      if (dollarRate) {
        dollarRate.dollarRate = req.body.dollarRate || dollarRate.dollarRate
  
        const updatedDollar = await dollarRate.save();
  
        if (!updatedDollar) {
          res.status(403).send({ message: "Что-то пошло не так!" });
          return;
        }
  
        res.status(200).send({ message: "Курс успешно обновлён!" });
      } else {
        return res.status(404).send({ message: "Курс не найден!" });
      }
    } catch (err) {
      console.log(err);
      res.status(500).send({ message: "INTERNAL SERVER ERROR" });
    }
  });
  