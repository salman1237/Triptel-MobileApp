// FR-404 - RN equivalent of the web's print sheet
// (frontend/src/app/my-esims/[id]/print/page.tsx): same rows, same "N days
// after you install it" fallback when the eSIM hasn't been activated yet, same
// install-steps box. Kept as a pure string builder (no RN imports) so it's
// trivially unit-testable and reusable as-is by FR-704's withdrawal receipt,
// which the FR notes takes "the same approach as FR-404".
export type ReceiptRow = { label: string; value: string; mono?: boolean };

export type EsimReceiptData = {
  brand: string;
  productTitle: string;
  orderNo: string;
  iccid: string | null;
  dataLabel: string;
  validityDays: number;
  expiresLabel: string;
  lpaString: string | null;
  // data:image/png;base64,... - the already-branded QR exported from the live
  // EsimQr component via react-native-svg's toDataURL(), not a second QR
  // generated some other way. See EsimQr.tsx's `getRef` prop.
  qrDataUri: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rowsHtml(rows: ReceiptRow[]): string {
  return rows
    .map(
      (r) =>
        `<tr><td class="label">${escapeHtml(r.label)}</td><td class="value${r.mono ? ' mono' : ''}">${escapeHtml(r.value)}</td></tr>`
    )
    .join('');
}

export function buildEsimReceiptHtml(data: EsimReceiptData): string {
  const rows: ReceiptRow[] = [
    { label: 'Order ID', value: data.orderNo },
    { label: 'Product', value: data.productTitle },
    { label: 'ICCID', value: data.iccid || '—', mono: true },
    { label: 'Data', value: data.dataLabel },
    { label: 'Plan Validity', value: `${data.validityDays} Days` },
    { label: 'Expires', value: data.expiresLabel },
  ];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 16mm; }
  body { background: #ffffff; color: #0f172a; font-family: -apple-system, Roboto, sans-serif; margin: 0; padding: 24px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 9px 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
  td.label { color: #64748b; white-space: nowrap; }
  td.value { text-align: right; color: #0f172a; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 800; }
  .header-note { font-size: 12px; color: #64748b; }
  h1 { font-size: 20px; margin: 0 0 4px 0; }
  .order-note { margin: 0 0 24px 0; font-size: 13px; color: #64748b; }
  .main-row { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 24px; }
  .qr-box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; }
  .qr-box img { width: 180px; height: 180px; }
  .qr-caption { margin: 10px 0 0 0; font-size: 11px; color: #64748b; }
  .detail-box { flex: 1; min-width: 260px; }
  .lpa-box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
  .lpa-label { margin: 0 0 4px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; }
  .lpa-value { margin: 0; font-size: 12px; word-break: break-all; }
  .install-box { background: #eef2ff; border-left: 3px solid #4f46e5; border-radius: 8px; padding: 14px 16px; }
  .install-title { margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #3730a3; }
  .install-box ol { margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.9; color: #475569; }
</style>
</head>
<body>
  <div class="header">
    <span class="brand">${escapeHtml(data.brand)}</span>
    <span class="header-note">eSIM Installation Details</span>
  </div>

  <h1>${escapeHtml(data.productTitle)}</h1>
  <p class="order-note">Order ${escapeHtml(data.orderNo)}</p>

  <div class="main-row">
    ${
      data.qrDataUri
        ? `<div class="qr-box">
            <img src="${data.qrDataUri}" />
            <p class="qr-caption">Scan with the phone that will use the eSIM</p>
          </div>`
        : ''
    }
    <div class="detail-box">
      <table>${rowsHtml(rows)}</table>
    </div>
  </div>

  ${
    data.lpaString
      ? `<div class="lpa-box">
          <p class="lpa-label">Activation Code (LPA)</p>
          <p class="lpa-value mono">${escapeHtml(data.lpaString)}</p>
        </div>`
      : ''
  }

  <div class="install-box">
    <p class="install-title">How to install</p>
    <ol>
      <li>Connect the phone to Wi-Fi.</li>
      <li><strong>iPhone:</strong> Settings &rsaquo; Cellular &rsaquo; Add eSIM &rsaquo; Use QR Code.</li>
      <li><strong>Android:</strong> Settings &rsaquo; Network &amp; Internet &rsaquo; SIMs &rsaquo; Add eSIM.</li>
      <li>Scan the QR code above, or enter the activation code manually.</li>
    </ol>
  </div>
</body>
</html>`;
}
