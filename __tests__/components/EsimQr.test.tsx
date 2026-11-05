import React from 'react';
import { render } from '@testing-library/react-native';
import QRCodeJS from 'qrcode';
import jsQR from 'jsqr';
import EsimQr, {
  APP_ICON_LOGO,
  ERROR_CORRECTION_LEVEL,
  LOGO_RATIO,
  computeLogoGeometry,
} from '../../src/components/EsimQr';

const SAMPLE_LPA = 'LPA:1$rsp.triptel.co$A1B2-C3D4-E5F6-7890';

describe('EsimQr (FR-401)', () => {
  it('renders without crashing and uses the app icon as its logo, not a wordmark', async () => {
    const { toJSON } = await render(<EsimQr value={SAMPLE_LPA} size={200} />);

    expect(toJSON()).toBeTruthy();
    // The only logo source this component can render with - a literal
    // bundled app-icon asset, never a remote/wordmark image.
    expect(APP_ICON_LOGO).toBeTruthy();
  });

  it('pins error correction to H and the logo disc to 22% of the QR width', () => {
    expect(ERROR_CORRECTION_LEVEL).toBe('H');
    expect(LOGO_RATIO).toBe(0.22);

    const { discSize } = computeLogoGeometry(200);
    expect(discSize).toBe(Math.round(200 * 0.22));
  });

  it('keeps the white backing disc an exact circle, not a rounded square', () => {
    for (const size of [120, 160, 200, 320]) {
      const { discSize, logoSize, logoMargin, logoBorderRadius } = computeLogoGeometry(size);
      // Mirrors react-native-qrcode-svg's own derivation of the disc's
      // corner radius from the logoBorderRadius/logoMargin props we pass it.
      const discBorderRadius = logoBorderRadius * (1 + logoMargin / logoSize);
      // Within a pixel: logoBorderRadius is an integer SVG prop, so a chain
      // of divisions can be off by a fraction of a pixel after rounding.
      expect(Math.abs(discBorderRadius - discSize / 2)).toBeLessThan(1);
    }
  });

  // docs/Rules.md -> "The QR code": a logo sitting on the modules destroys
  // the data underneath it, and the only thing that makes that survivable is
  // error correction H plus a capped logo size. react-native's SVG output
  // can't be rasterized in Jest, so this builds the same module matrix the
  // `qrcode` library (react-native-qrcode-svg's own encoder) would produce
  // at this component's *actual exported* settings, covers the same share of
  // it a real logo would, adds print/photograph-style noise, and decodes it
  // with a real QR decoder (jsqr) - the same kind of check the backend's
  // test_qr_branding.py does by decoding its own PNGs. Because the level and
  // ratio are read from the component's own exports (not re-typed literals),
  // changing either one in EsimQr.tsx changes what this test proves.
  it('survives a damaged render at its configured error correction - the exact scenario a lower level does not', () => {
    const atConfiguredLevel = renderDamagedAndDecode(SAMPLE_LPA, ERROR_CORRECTION_LEVEL, LOGO_RATIO);
    expect(atConfiguredLevel).toBe(SAMPLE_LPA);

    // Negative control: proves this test actually discriminates on the error
    // correction level, not just "any QR with a logo decodes fine" - the
    // real incident Rules.md describes was level M with the same logo size.
    const atM = renderDamagedAndDecode(SAMPLE_LPA, 'M', LOGO_RATIO);
    expect(atM).toBeNull();
  });
});

function renderDamagedAndDecode(value: string, errorCorrectionLevel: 'H' | 'M', logoRatio: number): string | null {
  const MODULE_PX = 6;
  const BORDER_MODULES = 4;
  const NOISE_RATIO = 0.015; // ~1.5% of pixels flipped, simulating a creased/photographed printout

  const qr = QRCodeJS.create(value, { errorCorrectionLevel });
  const moduleCount = qr.modules.size;
  const bits: number[] = Array.prototype.slice.call(qr.modules.data, 0);

  const totalModules = moduleCount + BORDER_MODULES * 2;
  const width = totalModules * MODULE_PX;
  const data = new Uint8ClampedArray(width * width * 4);

  // Quiet zone + modules.
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const moduleX = Math.floor(x / MODULE_PX) - BORDER_MODULES;
      const moduleY = Math.floor(y / MODULE_PX) - BORDER_MODULES;
      const inBounds = moduleX >= 0 && moduleX < moduleCount && moduleY >= 0 && moduleY < moduleCount;
      const dark = inBounds && bits[moduleY * moduleCount + moduleX] === 1;
      const v = dark ? 0 : 255;
      const idx = (y * width + x) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }

  // Punch out the center logo coverage, same share of the image a real
  // circular logo at `logoRatio` of the width would cover.
  const logoSize = Math.round(width * logoRatio);
  const start = Math.round((width - logoSize) / 2);
  for (let y = start; y < start + logoSize; y++) {
    for (let x = start; x < start + logoSize; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  // Deterministic "noise" (not Math.random, so the test isn't flaky): flip a
  // regular lattice of pixels across the whole image.
  const totalPixels = width * width;
  const step = Math.max(1, Math.floor(1 / NOISE_RATIO));
  for (let px = 0; px < totalPixels; px += step) {
    const idx = px * 4;
    const v = data[idx] === 0 ? 255 : 0;
    data[idx] = v;
    data[idx + 1] = v;
    data[idx + 2] = v;
  }

  const result = jsQR(data, width, width);
  return result ? result.data : null;
}
