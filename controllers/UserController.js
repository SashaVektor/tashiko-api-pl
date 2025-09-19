import expressAsyncHandler from "express-async-handler";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import { generateToken } from "../utils.js";

export const signIn = expressAsyncHandler(async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      if (bcrypt.compareSync(req.body.password, user.password)) {
        res.send({
          _id: user._id,
          name: user.name,
          email: user.email,
          status: user.status,
          phone: user.phone,
          address: user.address,
          fop: user.fop,
          token: generateToken(user),
        });
        return;
      }
    }
    res.status(401).send({ message: "Invalid email or password" });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

export const signUp = expressAsyncHandler(async (req, res) => {
  try {
    const person = await User.findOne({ email: req.body.email });

    if (person) {
      throw new Error("User already exist");
    }

    const saltRounds = 10;
    const salt = bcrypt.genSaltSync(saltRounds);

    const newUser = new User({
      email: req.body.email,
      password: bcrypt.hashSync(req.body.password, salt),
      name: req.body.name,
      status: req.body.status,
      phone: req.body.phone,
      address: req.body.address,
      fop: req.body.fop
    });

    const user = await newUser.save();

    res.send({
        _id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
        phone: user.phone,
        address: user.address,
        fop: user.fop,
        token: generateToken(user),
    });
  } catch (err) {
    res.status(401).send({ message: err.message });
  }
});

export const editUserInfo = expressAsyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id });
    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;
      user.address = req.body.address || user.address;
      user.fop = req.body.fop || user.fop;

      const updatedUser = await user.save();
      res.send({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        status: updatedUser.status,
        phone: updatedUser.phone,
        address: updatedUser.address,
        fop: updatedUser.fop,
        token: generateToken(updatedUser),
      });
      return;
    } else {
      res.status(404).send({ message: 'user not found' });
      return;
    }
  } catch (err) {
    res.status(400).send(err);
  }
});

