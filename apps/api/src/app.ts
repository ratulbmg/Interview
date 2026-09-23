import "dotenv/config";

import Express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes";

const app = Express();
app.use(cors());
app.use(Express.json());
app.use(cookieParser());

app.use(routes);

export default app;
