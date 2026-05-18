import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import usersRouter from "./users";
import companiesRouter from "./companies";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/projects", projectsRouter);
router.use("/users", usersRouter);
router.use("/companies", companiesRouter);

export default router;
