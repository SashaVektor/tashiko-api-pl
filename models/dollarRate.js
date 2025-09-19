import mongoose from "mongoose";

const dollarRateSchema = new mongoose.Schema(
    {
        dollarRate: {
            type: Number, default: 41.85
        },
       
    },
)

const DollarRate = mongoose.model('dollarrate', dollarRateSchema);
export default DollarRate