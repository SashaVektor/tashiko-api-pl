import express from 'express';
import { isAdmin, isAuth } from '../utils.js';
import { getStatistics } from '../controllers/statisticsController.js';


const statisticsRouter = express.Router();

statisticsRouter.get('/', isAuth, isAdmin, getStatistics);

export default statisticsRouter;