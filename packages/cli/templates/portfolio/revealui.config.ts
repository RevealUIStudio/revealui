import config from '@revealui/config';
import { buildConfig, universalPostgresAdapter } from '@revealui/core';
import sharp from 'sharp';
import { Projects } from './src/collections/Projects';

export default buildConfig({
  serverURL: config.reveal.publicServerURL || 'http://localhost:4000',
  secret: config.reveal.secret,
  db: config.database.url
    ? universalPostgresAdapter({ connectionString: config.database.url })
    : universalPostgresAdapter({ provider: 'electric' }),
  admin: {
    user: 'users',
  },
  collections: [Projects],
  globals: [],
  plugins: [],
  sharp,
});
