import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';
import multer from 'multer';

const upload = multer()

const uploadRouter = express.Router();

uploadRouter.post('/', upload.single('file'), async (req, res) => {
    try {
        cloudinary.config({
            cloud_name: process.env.CLOUD_NAME,
            api_key: process.env.CLOUD_KEY,
            api_secret: process.env.CLOUD_SECRET
        })
        const streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream((error, result) => {
                    if (result) {
                        resolve(result)
                    }
                    else {
                        reject(error);
                    }
                })
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            })
        }
        const result = await streamUpload(req);
        res.send(result);
    } catch (err) {
        console.log(err);
        res.status(500).send({ message: "INTERNAL SERVER ERROR" })
    }
})

export default uploadRouter;