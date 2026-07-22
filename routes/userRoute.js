import express from 'express';
import { editUserInfo, getAdminCustomerProfile, getAdminCustomers, signIn, signUp } from '../controllers/UserController.js';
import { isAdmin, isAuth } from '../utils.js';

const userRouter = express.Router();

userRouter.post('/signin', signIn);

userRouter.post('/signup', signUp);

userRouter.get('/admin/customers', isAuth, isAdmin, getAdminCustomers);
userRouter.get('/admin/customers/:id', isAuth, isAdmin, getAdminCustomerProfile);

userRouter.put('/:id', isAuth, editUserInfo);


export default userRouter;
