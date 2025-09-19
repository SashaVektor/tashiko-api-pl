import mongoose from "mongoose";

const crossNumbersSchema = new mongoose.Schema(
    {
        article_a: {
            type: String, 
        },
        brand_a: {
            type: String, 
        },
        article_b: {
            type: String, 
        },
        brand_b: {
            type: String, 
        },
      
    },
);

const CrossNumbers = mongoose.model('crossnumbers', crossNumbersSchema);
export default CrossNumbers;