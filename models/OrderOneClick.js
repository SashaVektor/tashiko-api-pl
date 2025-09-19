import mongoose from "mongoose";

const orderOneClickSchema = new mongoose.Schema(
    {
        name: {
            type: String, required: true,
        },
        phone: {
            type: String, required: true,
        },
        isPaid: {
            type: Boolean, required: true,
        },
        status: {
            type: String, required: true,
        },
        userId: {
            type: String
        },
        basketItem: {
            _id: {
                type: String,
            },
            currency: {
                type: String,
            },
            imageLink: {
                type: String,
            },
            name:{
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
        },
       
    },
    {
        timestamps: true
    }
)

const OrderOneClick = mongoose.model('OrderOneClick', orderOneClickSchema);
export default OrderOneClick