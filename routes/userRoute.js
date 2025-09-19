import express from 'express';
import { editUserInfo, signIn, signUp } from '../controllers/UserController.js';
import { isAuth } from '../utils.js';

const userRouter = express.Router();

userRouter.post('/signin', signIn);

userRouter.post('/signup', signUp);

userRouter.put('/:id', isAuth, editUserInfo);


export default userRouter;