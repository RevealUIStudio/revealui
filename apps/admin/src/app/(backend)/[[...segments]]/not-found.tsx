/* RevealUI Admin Not Found Page */

import { generatePageMetadata, NotFoundPage } from '@revealui/core/admin';
import type { Metadata } from 'next';

export const generateMetadata = async (): Promise<Metadata> => {
  return generatePageMetadata();
};

const NotFound = async () => {
  return NotFoundPage();
};

export default NotFound;
