import React from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// Kept in step with LOGO_RATIO/RING_RATIO/ERROR_CORRECTION in
// backend/app/services/qr_branding.py and frontend/src/components/EsimQr.tsx -
// the three should never drift apart, or the emailed QR, the web QR, and this
// one stop behaving the same. See docs/Rules.md -> "The QR code".
export const LOGO_RATIO = 0.22;
export const RING_RATIO = 0.12;
export const ERROR_CORRECTION_LEVEL = 'H' as const;
export const APP_ICON_LOGO = require('../../assets/icon.png');

export type LogoGeometry = {
  discSize: number;
  logoMargin: number;
  logoSize: number;
  logoBorderRadius: number;
};

/**
 * The white backing disc's full size is `size * LOGO_RATIO`; the logo
 * artwork sits inset from it by a ring margin. `logoBorderRadius` is solved
 * so react-native-qrcode-svg's disc - whose corner radius it derives as
 * `logoBorderRadius * (1 + logoMargin/logoSize)` - renders as an exact
 * circle (not a rounded square) regardless of the ring margin.
 */
export function computeLogoGeometry(size: number): LogoGeometry {
  const discSize = Math.round(size * LOGO_RATIO);
  const logoMargin = Math.round(discSize * RING_RATIO);
  const logoSize = discSize - logoMargin * 2;
  const logoBorderRadius = Math.round((logoSize * discSize) / (2 * (logoSize + logoMargin)));
  return { discSize, logoMargin, logoSize, logoBorderRadius };
}

type EsimQrProps = {
  value: string;
  size?: number;
  testID?: string;
  // FR-404 - the receipt PDF needs this exact branded QR as a raster image
  // (expo-print can't render a live RN SVG component), not a second,
  // separately-generated QR - see docs/Rules.md -> "The QR code" on why
  // every render of this QR must match byte-for-byte. react-native-svg's
  // own toDataURL() on this ref is how src/lib/esimReceipt.ts gets it.
  getRef?: (ref: unknown) => void;
};

/**
 * The eSIM QR with the Triptel app icon in the middle.
 *
 * Error correction H (~30% recoverable) is what makes a logo sitting on top
 * of the QR's modules survivable - these were level M (~15%) before any
 * logo existed, which is not enough to cover the centre. Dropping to a
 * lower level "because it still scans on a clean screen" is exactly how
 * the web app once shipped a QR that failed on a folded, photographed
 * printout - see docs/Rules.md -> "The QR code".
 */
export default function EsimQr({ value, size = 200, testID, getRef }: EsimQrProps) {
  const { logoSize, logoMargin, logoBorderRadius } = computeLogoGeometry(size);

  return (
    <View testID={testID}>
      <QRCode
        value={value}
        size={size}
        ecl={ERROR_CORRECTION_LEVEL}
        backgroundColor="#FFFFFF"
        color="#000000"
        logo={APP_ICON_LOGO}
        logoSize={logoSize}
        logoMargin={logoMargin}
        logoBorderRadius={logoBorderRadius}
        getRef={getRef}
        testID="esim-qr-code"
      />
    </View>
  );
}
