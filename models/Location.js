import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
    },
    location: [
      {
        address: {
          type: String,
          required: true,
        },
        phone: {
          type: String,
          required: true,
        },
        time: {
          type: String,
          required: true,
        },
        mapUrl: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Location = mongoose.model("Location", locationSchema);
export default Location;
