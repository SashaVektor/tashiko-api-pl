import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String, required: true, unique: true,
        },
        slug: {
            type: String, required: true, unique: true,
        },
        image: {
            type: String, required: true
        },
        isActive: {
            type: Boolean, default: true
        }
    },
    {
        timestamps: true
    }
);

const Category = mongoose.model('Category', categorySchema);
export default Category;