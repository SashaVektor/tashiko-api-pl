import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String, default: ""
        },
        email: {
            type: String, required: true, unique: true,
        },
        phone: {
            type: String, required: true,
        },
        password: {
            type: String, default: ""
        },
        status: {
            type: String, default: "member"
        },
        fop: {
            type: String, default: ""
        },
        address: {
            type: String, required: true,
        },
    },
    {
        timestamps: true
    }
)

const User = mongoose.model('User', userSchema);
export default User