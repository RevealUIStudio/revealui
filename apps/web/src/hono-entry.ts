import "dotenv/config";

import { createTodoHandler } from "./server/create-todo-handler";
import { revealuiHandler } from "./server/revealui-handler";
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createHandler, createMiddleware } from "@universal-middleware/hono";
import { dbMiddleware } from "./server/db-middleware";

const app = new Hono();

app.use(createMiddleware(dbMiddleware)());

app.post("/api/todo/create", createHandler(createTodoHandler)());

/**
 * RevealUI route
 *
 * @link {@see https://revealui.com}
 **/
app.all("*", createHandler(revealuiHandler)());

export const GET = handle(app);

export const POST = handle(app);

export default process.env.NODE_ENV === "production" ? undefined : app;
