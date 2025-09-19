import mongoose from "mongoose";

const vinRequestSchema = new mongoose.Schema(
    {
        phone: {
            type: String, required: true,
        },
        vin: {
            type: String,
        },
        photo: {
            type: String, 
        },
        text: {
            type: String, required: true
        },
        userId: {
            type: String,
        },
        status: {
            type: String, default: "Не обработан"
        }
    },
    {
        timestamps: true
    }
);

const VINRequest = mongoose.model('VINRequest', vinRequestSchema);
export default VINRequest;