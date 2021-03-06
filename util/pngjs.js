/**
 * @file PNGJS Utility methods
 */
import stream from 'stream';
import rgbHex from 'rgb-hex';
import request from 'request';
import fileType from 'file-type';
import config from 'config';
import { PNG } from 'pngjs';
import base64Stream from 'base64-stream';
import { throwError, ERRORS } from './errors';
import Logger from './logger';

const logger = Logger('PNGJS.Logger');


const ACCEPTED_DATA_TYPES = [
  // this is only a PNG Util, no more types should be added here.
  'image/png',
];

const imageToObject = (pngImage) => {
  const pngData = [];
  for (let y = 0; y < pngImage.height; y += 1) {
    const row = [];
    for (let x = 0; x < pngImage.width; x += 1) {
      const pixelIndex = ((pngImage.width * y) + x) << 2;
      const r = pngImage.data[pixelIndex];
      const g = pngImage.data[pixelIndex + 1];
      const b = pngImage.data[pixelIndex + 2];
      const a = pngImage.data[pixelIndex + 3];

      const parseTransparentPixels = config.get('parseTransparentPixels');

      const hex = rgbHex(r, g, b);
      row.push({
        r,
        g,
        b,
        a: (parseTransparentPixels && a) || undefined,
        hex,
        isTransparent: a === 0,
      });
    }

    pngData.push(row);
  }

  return pngData;
};

/**
* @param {String} imageUrl the URL to fetch the png from.
* @returns {Promise} a promise to read the stream and return a PngJS object.
*/
export const fetchPngFromUrl = imageUrl => new Promise((resolve, reject) => {
  request
    .get(imageUrl)
    .on('error', reject)
    .on('data', (chunk) => {
      const mimeData = fileType(chunk);
      if (mimeData && !ACCEPTED_DATA_TYPES.includes(mimeData.mime)) {
        reject(throwError(ERRORS.E002));
      }
    })
    .on('response', (response) => {
      if (!ACCEPTED_DATA_TYPES.includes(response.headers['content-type'])) {
        reject(throwError(ERRORS.E002));
      }
    })
    .pipe(new PNG())
    .on('parsed', function () {
      logger.info('fetchPngFromUrl :: Parsed here.', {
        height: this.height,
        width: this.width,
      });

      resolve(imageToObject(this));
    })
    .on('error', (err) => {
      logger.error('fetchPngFromUrl :: error.', err);
      reject(err);
    });
});

export const pngFromBase64 = base64 => new Promise((resolve, reject) => {
  const base64Input = new stream.Readable();
  base64Input.push(base64.split(',').pop());
  base64Input.push(null);

  base64Input
    .pipe(base64Stream.decode())
    .on('data', (chunk) => {
      const mimeData = fileType(chunk);
      if (mimeData && !ACCEPTED_DATA_TYPES.includes(mimeData.mime)) {
        reject(throwError(ERRORS.E002));
      }
    })
    .pipe(new PNG())
    .on('parsed', function () {
      logger.info('pngFromBase64 :: Image Parsed', {
        height: this.height,
        width: this.width,
      });

      resolve(imageToObject(this));
    })
    .on('error', (err) => {
      logger.error('pngFromBase64 :: error: ', err);
      reject(err);
    });
});
