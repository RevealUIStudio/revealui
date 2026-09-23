/**
 * Optional PNG raster of a themed diagram SVG (P1 2D only).
 */

import sharp from 'sharp';

export async function pngFromSvg(svg: string): Promise<string> {
  const buffer = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
  return buffer.toString('base64');
}
