import mongoose from "mongoose";

const userGarageSchema = new mongoose.Schema(
  {
    selectedYear: {
      type: String,
      required: true,
    },
    selectedBrand: {
      type: String,
      required: true,
    },
    selectedMark: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const UserGarage = mongoose.model("UserGarage", userGarageSchema);
export default UserGarage;
