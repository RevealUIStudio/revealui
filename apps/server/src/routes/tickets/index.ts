import { OpenAPIHono } from '@revealui/openapi';
import type { Variables } from '../_helpers/access.js';
import boardsRoute from './boards.js';
import columnsRoute from './columns.js';
import commentsRoute from './comments.js';
import labelsRoute from './labels.js';
import ticketsRoute from './tickets.js';

const app = new OpenAPIHono<{ Variables: Variables }>();

app.route('/', boardsRoute);
app.route('/', columnsRoute);
app.route('/', ticketsRoute);
app.route('/', commentsRoute);
app.route('/', labelsRoute);

export default app;
