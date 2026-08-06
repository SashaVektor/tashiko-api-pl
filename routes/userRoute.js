import express from 'express';
import { createAdminCustomer, deleteAdminCustomer, editUserInfo, getAdminCustomerProfile, getAdminCustomers, signIn, signUp, updateAdminCustomer } from '../controllers/UserController.js';
import { isAdmin, isAuth } from '../utils.js';

const userRouter = express.Router();

userRouter.post('/signin', signIn);

userRouter.post('/signup', signUp);

userRouter.get('/admin/customers', isAuth, isAdmin, getAdminCustomers);
userRouter.post('/admin/customers', isAuth, isAdmin, createAdminCustomer);
userRouter.get('/admin/customers/:id', isAuth, isAdmin, getAdminCustomerProfile);
userRouter.put('/admin/customers/:id', isAuth, isAdmin, updateAdminCustomer);
userRouter.delete('/admin/customers/:id', isAuth, isAdmin, deleteAdminCustomer);

userRouter.put('/:id', isAuth, editUserInfo);


export default userRouter;
