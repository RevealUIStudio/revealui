import { Hono } from 'hono';
import runRoute from './run.js';

const app = new Hono();
app.route('/', runRoute);

export default app;
