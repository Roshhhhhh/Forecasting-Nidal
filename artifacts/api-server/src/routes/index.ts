import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import ownersRouter from "./owners";
import propertiesRouter from "./properties";
import marketRouter from "./market";
import forecastsRouter from "./forecasts";
import proposalsRouter from "./proposals";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";
import refereesRouter from "./referees";
import rolesRouter from "./roles";
import amenitiesRouter from "./amenities";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(rolesRouter);
router.use(usersRouter);
router.use(ownersRouter);
router.use(propertiesRouter);
router.use(marketRouter);
router.use(forecastsRouter);
router.use(proposalsRouter);
router.use(dashboardRouter);
router.use(settingsRouter);
router.use(refereesRouter);
router.use(amenitiesRouter);

export default router;
