import expressAsyncHandler from "express-async-handler";
import Location from "../models/Location.js";

export const getLocations = expressAsyncHandler(async (req, res) => {
  try {
    const locations = await Location.find();
    res.send(locations);
  } catch (err) {
    res.status(401).send({ message: "Что-то пошло не так!" });
  }
});

export const createLocation = expressAsyncHandler(async (req, res) => {
  try {
    const location = req.body;
    const newLocation = new Location({
      location: location.location,
      title: location.title,
    });
    const loc = await newLocation.save();
    if (loc) {
      res.status(200).send({ message: "Локация успешно создана!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const editLocation = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const location = await Location.findById(id);

    if (location) {
      location.title = req.body.title || location.title
      location.location = req.body.location || location.location

      const updatedLocation = await location.save();

      if (!updatedLocation) {
        res.status(403).send({ message: "Что-то пошло не так!" });
        return;
      }

      res.status(200).send({ message: "Локация успешно обновлена!" });
    } else {
      return res.status(404).send({ message: "Локация не найдена!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

export const removeLocation = expressAsyncHandler(async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (location) {
      await location.deleteOne();
      res.send({ message: "Локация успешно удалена!" });
    } else {
      res.status(404).send({ message: "Локация не найдена!" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});
