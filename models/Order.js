import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
    },
    userInfo: {
      name: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
      },
      fop: {
        type: String,
      },
      userDeliv: {
        type: String,
        required: true,
      },
    },
    deliveryMethod: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
    },
    comment: {
      type: String,
    },
    isPaid: {
      type: Boolean,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    basketItems: [{
      _id: {
        type: String,
      },
      currency: {
        type: String,
      },
      imageLink: {
        type: String,
      },
      name: {
        type: String,
      },
      price: {
        type: Number,
      },
      quantity: {
        type: Number,
      },
      productCode: {
        type: String,
      },
    }],
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;
