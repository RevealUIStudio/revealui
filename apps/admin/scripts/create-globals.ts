/**
 * Seed Header and Footer singleton rows via drizzle (`id = '1'`).
 * Do not use RevealUIGlobal / `global_${slug}` inserts (F-089-0009).
 */

import { getClient } from '@revealui/db';
import {
  getGlobalFooter,
  getGlobalHeader,
  updateGlobalFooter,
  updateGlobalHeader,
} from '@revealui/db/queries/globals';

async function createGlobals() {
  console.log('Creating Header and Footer globals...\n');

  try {
    const db = getClient();

    console.log('Header global...');
    const existingHeader = await getGlobalHeader(db);
    if (existingHeader) {
      console.log('Header global already exists (id=', existingHeader.id, ')');
    } else {
      await updateGlobalHeader(db, {
        navItems: [
          { label: 'Home', url: '/' },
          { label: 'Posts', url: '/posts' },
          { label: 'Admin', url: '/admin' },
        ],
      });
      console.log('Header global created (id=1)');
    }

    console.log('\nFooter global...');
    const existingFooter = await getGlobalFooter(db);
    if (existingFooter) {
      console.log('Footer global already exists (id=', existingFooter.id, ')');
    } else {
      await updateGlobalFooter(db, {
        columns: [
          {
            label: 'Legal',
            links: [
              { label: 'Privacy Policy', url: '/privacy' },
              { label: 'Terms of Service', url: '/terms' },
              { label: 'Contact', url: '/contact' },
            ],
          },
        ],
        copyright: 'RevealUI',
      });
      console.log('Footer global created (id=1)');
    }

    console.log('\nDone. Edit at /admin/globals/header and /admin/globals/footer');
    process.exit(0);
  } catch (error) {
    console.error('\nError creating globals:', error);
    process.exit(1);
  }
}

createGlobals();
