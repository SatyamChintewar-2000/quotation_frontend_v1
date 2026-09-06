import React, { useEffect, useState, useCallback } from 'react';
import { companyService, Company } from '@/services/companyService';
import QRCode from 'qrcode';
import { getPdfTheme } from '@/constants/pdfThemes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface QuotationItem {
  productId?: number;
  productName?: string;
  productNameSnapshot?: string;
  unitPrice?: number;
  price?: number;
  quantity: number;
  discountPercentage?: number;
  discount?: number;
  /** Flat rupee discount amount — when > 0, shown in PDF instead of %-derived price */
  discountAmount?: number;
  taxPercentage?: number;
  gst?: number;
  itemTotal?: number;
  subtotal?: number;
  imagePath?: string;
  imagePathSnapshot?: string;
  image?: string;
  description?: string;
  productDescription?: string;
  productDescriptionSnapshot?: string;
  // Weight & CBM snapshots captured at time of quoting
  netWeightSnapshot?: number;
  cbmSnapshot?: number;
}

interface QuotationData {
  id: string | number;
  quotationNumber?: string;
  clientName?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  shippingAddress?: string;
  createdAt: string;
  status: string;
  expiryDate?: string;
  quotationDate?: string;
  deliveryDate?: string;
  executiveName?: string;
  quotationCode?: string;
  notes?: string;
  termsAndConditions?: string;
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  grandTotal: number;
  items: QuotationItem[];
  services?: { serviceName: string; servicePrice: number; serviceTax: number }[];
  hideServiceChargesOnPdf?: boolean;
}

interface Props {
  quotation: QuotationData;
  forPdf?: boolean; // when true, suppress watermark (html2canvas capture)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const BORDER_COLOR = '#d1d5db';
const TEXT_DARK = '#111827';
const TEXT_GRAY = '#4b5563';

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtINR = (n: number) =>
  '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n));

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
  'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
  'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
  'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n: number): string {
  if (n === 0) return 'Zero Only';
  const num = Math.round(n);
  const inWords = (x: number): string => {
    if (x === 0) return '';
    if (x < 20) return ones[x] + ' ';
    if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '') + ' ';
    if (x < 1000) return ones[Math.floor(x / 100)] + ' Hundred ' + inWords(x % 100);
    if (x < 100000) return inWords(Math.floor(x / 1000)) + 'Thousand ' + inWords(x % 1000);
    if (x < 10000000) return inWords(Math.floor(x / 100000)) + 'Lakh ' + inWords(x % 100000);
    return inWords(Math.floor(x / 10000000)) + 'Crore ' + inWords(x % 10000000);
  };
  return inWords(num).trim() + ' Only';
}

/**
 * Decode a base64/URL image into a reliable data-URL.
 * Returns the original src on success, empty string on failure.
 * This ensures the image is fully decoded before html2canvas runs.
 */
async function resolveImage(src: string): Promise<string> {
  if (!src) return '';
  // Fix broken MIME type from older data
  const fixed = src.includes('data:image/null')
    ? src.replace('data:image/null', 'data:image/jpeg')
    : src;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(fixed);
    img.onerror = () => {
      // Try without crossOrigin as fallback
      const fallback = new Image();
      fallback.onload = () => resolve(fixed);
      fallback.onerror = () => resolve(''); // give up — show placeholder
      fallback.src = fixed;
    };
    if (fixed.startsWith('data:')) {
      // Base64 images never need crossOrigin
      img.src = fixed;
    } else {
      img.crossOrigin = 'anonymous';
      img.src = fixed;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const QuotationPrintView = React.forwardRef<HTMLDivElement, Props>(({ quotation, forPdf = false }, ref) => {
  const [company, setCompany] = useState<Company | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [resolvedImages, setResolvedImages] = useState<Record<number, string>>({});
  const [imagesReady, setImagesReady] = useState(false);

  // Load company
  useEffect(() => {
    companyService.getMyCompany()
      .then(setCompany)
      .catch(() =>
        companyService.getAll()
          .then(list => list.length && setCompany(list[0]))
          .catch(() => {})
      );
  }, []);

  // Resolve PDF theme
  const theme = getPdfTheme(company?.pdfThemeName, company?.pdfAccentColor);
  const PRIMARY_COLOR = theme.primaryColor;
  const LIGHT_BG = theme.lightBg;

  const showWatermark = !!(company?.pdfWatermarkEnabled && company?.logo);
  const watermarkOpacity = company?.pdfWatermarkOpacity ?? 0.07;

  // Service totals
  const hideServiceCharges = quotation.hideServiceChargesOnPdf === true;
  const serviceTotal = (quotation.services || []).reduce((acc, sv) => {
    const price = Number(sv.servicePrice) || 0;
    const tax   = Number(sv.serviceTax)   || 0;
    return acc + price + price * tax / 100;
  }, 0);

  // Recalculate grand total — always includes services regardless of stored value
  const grandTotal = quotation.subtotal
    - quotation.totalDiscount
    + quotation.totalGst
    + serviceTotal;

  // QR code
  useEffect(() => {
    if (company?.upiId) {
      const upiString = `upi://pay?pa=${company.upiId}&pn=${encodeURIComponent(company.companyName)}&am=${grandTotal}&cu=INR`;
      QRCode.toDataURL(upiString, { width: 120, margin: 1 })
        .then(setQrCodeUrl)
        .catch(() => setQrCodeUrl(''));
    }
  }, [company?.upiId, grandTotal]);

  // Resolve ALL product images before marking ready
  // This is the fix for images disappearing in PDF:
  // we await every image decode before html2canvas fires
  const processImages = useCallback(async () => {
    setImagesReady(false);
    const results: Record<number, string> = {};
    await Promise.all(
      quotation.items.map(async (item, idx) => {
        const raw = item.imagePathSnapshot || item.imagePath || item.image || '';
        results[idx] = await resolveImage(raw);
      })
    );
    setResolvedImages(results);
    setImagesReady(true);
  }, [quotation.items]);

  useEffect(() => { processImages(); }, [processImages]);

  const clientName = quotation.clientName || quotation.customerName || '—';
  const qNumber    = quotation.quotationNumber || `Q-${quotation.id}`;
  const qDate      = fmtDate(quotation.quotationDate || quotation.createdAt);
  const delivDate  = fmtDate(quotation.deliveryDate);
  const compName   = company?.companyName || 'Company';

  return (
    <div
      ref={ref}
      data-images-ready={imagesReady ? 'true' : 'false'}
      style={{
        width: '794px',
        background: '#fff',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        fontSize: '12px',
        color: TEXT_DARK,
        boxSizing: 'border-box',
        padding: '0',
        position: 'relative',
        // Add page break styles directly
        pageBreakInside: 'avoid',
        orphans: 2,
        widows: 2,
      }}
    >
      {/* ── Watermark — only shown in browser view, never in PDF capture ── */}
      {showWatermark && company?.logo && !forPdf && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-20deg)',
            pointerEvents: 'none',
            zIndex: 0,
            width: '340px',
            height: '340px',
          }}
        >
          <img
            src={company.logo}
            alt=""
            style={{
              width: '340px',
              height: '340px',
              objectFit: 'contain',
              // Keep opacity very low — JPEG baking makes it appear ~3x darker than screen
              opacity: 0.04,
              // Desaturate + lighten so dark logos (navy, black) become pale grey
              filter: 'grayscale(100%) brightness(2.5)',
            }}
          />
        </div>
      )}

      {/* ── All content sits above watermark ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ══ HEADER ═══════════════════════════════════════════════════════ */}
        <div style={{
          borderBottom: `3px solid ${PRIMARY_COLOR}`,
          padding: '28px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
        }}>
          {company?.logo && (
            <div style={{ marginRight: '32px', flexShrink: 0 }}>
              <img
                src={company.logo}
                alt="logo"
                style={{ height: '100px', maxWidth: '240px', objectFit: 'contain', display: 'block' }}
              />
            </div>
          )}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: '900', color: PRIMARY_COLOR, letterSpacing: '0.5px', marginBottom: '10px' }}>
              {compName.toUpperCase()}
            </div>
            {company?.address && (
              <div style={{ fontSize: '11px', color: TEXT_DARK, lineHeight: '1.7', marginBottom: '8px', fontWeight: '500' }}>
                {company.address}
              </div>
            )}
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: '8px' }}>
              {company?.phone && <span style={{ fontSize: '11px', color: TEXT_DARK, fontWeight: '700' }}>Phone: {company.phone}</span>}
              {company?.email && <span style={{ fontSize: '11px', color: TEXT_DARK, fontWeight: '700' }}>Email: {company.email}</span>}
            </div>
            {company?.gstNumber && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: TEXT_DARK, background: LIGHT_BG, padding: '5px 14px', borderRadius: '6px', border: `2px solid ${PRIMARY_COLOR}`, display: 'inline-block' }}>
                GST: {company.gstNumber}
              </span>
            )}
          </div>
        </div>

        {/* ══ BILL TO + TITLE + DETAILS ════════════════════════════════════ */}
        <div style={{ display: 'flex', borderBottom: `2px solid ${BORDER_COLOR}` }}>
          {/* Bill To */}
          <div style={{ flex: 1, padding: '20px 32px', borderRight: `2px solid ${BORDER_COLOR}`, background: '#fff' }}>
            <div style={{ fontSize: '10px', color: TEXT_GRAY, marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Bill To:</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: TEXT_DARK, marginBottom: '6px', lineHeight: '1.3' }}>{clientName}</div>
            {quotation.customerPhone && (
              <div style={{ fontSize: '12px', color: TEXT_DARK, marginTop: '6px', fontWeight: '700' }}>📱 {quotation.customerPhone}</div>
            )}
            {quotation.customerAddress && (
              <div style={{ fontSize: '11px', color: TEXT_DARK, marginTop: '6px', lineHeight: '1.7', fontWeight: '500' }}>
                📍 {quotation.customerAddress}
              </div>
            )}
            {quotation.shippingAddress && (
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: `1px dashed ${BORDER_COLOR}` }}>
                <div style={{ fontSize: '10px', color: TEXT_GRAY, marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Ship To:</div>
                <div style={{ fontSize: '11px', color: TEXT_DARK, lineHeight: '1.7', fontWeight: '500' }}>
                  📦 {quotation.shippingAddress}
                </div>
              </div>
            )}
          </div>

          {/* QUOTATION title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 32px', borderRight: `2px solid ${BORDER_COLOR}`, minWidth: '200px', background: '#fff' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '26px', fontWeight: '900', color: PRIMARY_COLOR, letterSpacing: '2px', marginBottom: '6px' }}>QUOTATION</div>
              <div style={{ width: '80px', height: '3px', background: PRIMARY_COLOR, margin: '0 auto' }} />
            </div>
          </div>

          {/* Quote details */}
          <div style={{ padding: '20px 32px', minWidth: '240px', background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ color: TEXT_GRAY, paddingBottom: '10px', paddingRight: '16px', fontWeight: '700', whiteSpace: 'nowrap' }}>Quote No:</td>
                  <td style={{ fontWeight: '900', paddingBottom: '10px', color: PRIMARY_COLOR, fontSize: '13px' }}>{qNumber}</td>
                </tr>
                <tr>
                  <td style={{ color: TEXT_GRAY, paddingBottom: '10px', paddingRight: '16px', fontWeight: '700', whiteSpace: 'nowrap' }}>Quote Date:</td>
                  <td style={{ fontWeight: '800', paddingBottom: '10px', color: TEXT_DARK }}>{qDate}</td>
                </tr>
                {quotation.deliveryDate && (
                  <tr>
                    <td style={{ color: TEXT_GRAY, paddingRight: '16px', fontWeight: '700', whiteSpace: 'nowrap', paddingBottom: '10px' }}>Expected Delivery Date:</td>
                    <td style={{ fontWeight: '800', color: TEXT_DARK, paddingBottom: '10px' }}>{delivDate}</td>
                  </tr>
                )}
                {quotation.expiryDate && (
                  <tr>
                    <td style={{ color: TEXT_GRAY, paddingRight: '16px', fontWeight: '700', whiteSpace: 'nowrap' }}>Expiry Date:</td>
                    <td style={{ fontWeight: '800', color: '#dc2626' }}>{fmtDate(quotation.expiryDate)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ PRODUCTS TABLE ═══════════════════════════════════════════════ */}
        <div style={{ padding: '0 32px 24px 32px' }}>
          <div style={{ marginTop: '20px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: TEXT_DARK, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Product Details
            </div>
            <div style={{ width: '90px', height: '3px', background: PRIMARY_COLOR, marginTop: '5px' }} />
          </div>

          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: `2px solid ${BORDER_COLOR}`,
            // Enhanced page break controls for table
            pageBreakInside: 'auto',
            pageBreakBefore: 'auto',
            pageBreakAfter: 'auto',
            tableLayout: 'fixed'
          }}>
            <thead>
              <tr style={{ background: PRIMARY_COLOR }}>
                {[
                  { label: 'Sr.No.',            w: '44px',  align: 'center' as const },
                  { label: 'Product Image',     w: '110px', align: 'center' as const },
                  { label: 'Product Details',   w: 'auto',  align: 'left'   as const },
                  { label: 'HSN',           w: '65px',  align: 'center' as const },
                  { label: 'Unit Price (Rs.)',   w: '72px',  align: 'right'  as const },
                  { label: 'Qty',               w: '40px',  align: 'center' as const },
                  { label: 'Disc (Rs.)',         w: '72px',  align: 'right'  as const },
                  { label: 'Taxable (Rs.)',      w: '80px',  align: 'right'  as const },
                  { label: 'GST %',             w: '44px',  align: 'center' as const },
                  { label: 'Total (Rs.)',        w: '80px',  align: 'right'  as const },
                ].map((col, i, arr) => (
                  <th
                    key={col.label}
                    style={{
                      padding: '12px 10px',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '11px',
                      textAlign: col.align,
                      width: col.w,
                      borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, idx) => {
                const price     = Number(item.unitPrice ?? item.price ?? 0);
                const disc      = Number(item.discountPercentage ?? item.discount ?? 0);
                const flatAmt   = Number(item.discountAmount ?? 0);
                const tax       = Number(item.taxPercentage ?? item.gst ?? 0);
                const base      = price * item.quantity;
                // When a flat amount was saved, use it directly; otherwise derive from %
                const discValue = flatAmt > 0 ? flatAmt : base * disc / 100;
                const afterDisc = base - discValue;
                const total     = afterDisc + afterDisc * tax / 100;
                // Best Price (per unit after discount)
                const bestPrice = flatAmt > 0 ? price - flatAmt / item.quantity : price - price * disc / 100;
                const imgSrc    = resolvedImages[idx] ?? '';
                const name      = item.productNameSnapshot || item.productName || '—';
                const desc      = item.productDescriptionSnapshot || item.productDescription || item.description || '';
                const rowBg     = idx % 2 === 0 ? '#fff' : LIGHT_BG;

                return (
                  <tr
                    key={idx}
                    style={{
                      background: rowBg,
                      borderBottom: `1px solid ${BORDER_COLOR}`,
                      // Enhanced page break controls to prevent row splitting
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      pageBreakBefore: 'auto',
                      pageBreakAfter: 'auto',
                      // Ensure minimum height for proper page breaks
                      minHeight: '100px',
                      height: 'auto',
                    }}
                  >
                    {/* Sr No */}
                    <td style={{ padding: '14px 10px', textAlign: 'center', color: TEXT_DARK, fontWeight: '700', verticalAlign: 'middle', borderRight: `1px solid ${BORDER_COLOR}` }}>
                      {idx + 1}
                    </td>

                    {/* Image + name */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle', borderRight: `1px solid ${BORDER_COLOR}`, width: '120px' }}>
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={name}
                          style={{
                            width: '90px',
                            height: '90px',
                            objectFit: 'contain',
                            display: 'block',
                            margin: '0 auto 6px',
                            border: `1px solid ${BORDER_COLOR}`,
                            borderRadius: '4px',
                            background: '#fff',
                            // Critical: force the image to paint synchronously
                            // html2canvas reads already-decoded images fine
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '90px',
                          height: '90px',
                          background: LIGHT_BG,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '28px',
                          borderRadius: '4px',
                          border: `1px solid ${BORDER_COLOR}`,
                          margin: '0 auto 6px',
                        }}>
                          📦
                        </div>
                      )}
                      <div style={{ fontSize: '10px', fontWeight: '700', color: TEXT_DARK, textAlign: 'center', wordBreak: 'break-word', maxWidth: '100px', margin: '0 auto' }}>
                        {name}
                      </div>
                    </td>

                    {/* Product details */}
                    <td style={{ padding: '14px 12px', verticalAlign: 'top', borderRight: `1px solid ${BORDER_COLOR}` }}>
                      <div style={{ fontWeight: '800', fontSize: '12px', marginBottom: '6px', color: PRIMARY_COLOR }}>
                        {compName}
                      </div>
                      {desc && (
                        <div style={{ fontSize: '11px', color: TEXT_DARK, lineHeight: '1.8', whiteSpace: 'pre-wrap', fontWeight: '500' }}>
                          {desc}
                        </div>
                      )}
                    </td>

                    {/* HSN/SAC */}
                    <td style={{ padding: '14px 8px', textAlign: 'center', verticalAlign: 'middle', color: TEXT_GRAY, fontSize: '10px', fontWeight: '600', borderRight: `1px solid ${BORDER_COLOR}`, width: '60px' }}>
                      {(item as any).hsnSacCode || '—'}
                    </td>

                    {/* Unit Price */}
                    <td style={{ padding: '14px 10px', textAlign: 'right', verticalAlign: 'middle', color: TEXT_GRAY, fontWeight: '700', fontSize: '11px', borderRight: `1px solid ${BORDER_COLOR}` }}>
                      {new Intl.NumberFormat('en-IN').format(price)}
                    </td>

                    {/* Qty */}
                    <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '800', color: TEXT_DARK, fontSize: '11px', borderRight: `1px solid ${BORDER_COLOR}`, width: '40px' }}>
                      {item.quantity}
                    </td>

                    {/* Discount in ₹ — total row discount */}
                    <td style={{ padding: '14px 10px', textAlign: 'right', verticalAlign: 'middle', color: discValue > 0 ? '#dc2626' : TEXT_GRAY, fontWeight: '700', fontSize: '11px', borderRight: `1px solid ${BORDER_COLOR}` }}>
                      {discValue > 0 ? `-${new Intl.NumberFormat('en-IN').format(Math.round(discValue))}` : '—'}
                    </td>

                    {/* Taxable = base - discValue */}
                    <td style={{ padding: '14px 10px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '800', color: TEXT_DARK, fontSize: '11px', borderRight: `1px solid ${BORDER_COLOR}` }}>
                      {new Intl.NumberFormat('en-IN').format(Math.round(afterDisc))}
                    </td>

                    {/* GST % */}
                    <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle', color: TEXT_GRAY, fontWeight: '600', fontSize: '10px', borderRight: `1px solid ${BORDER_COLOR}` }}>
                      {tax > 0 ? `${tax}%` : '—'}
                    </td>

                    {/* Total */}
                    <td style={{ padding: '14px 10px', textAlign: 'right', fontWeight: '900', verticalAlign: 'middle', color: PRIMARY_COLOR, fontSize: '13px' }}>
                      {new Intl.NumberFormat('en-IN').format(Math.round(total))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ══ BOTTOM SECTION ═══════════════════════════════════════════════
            Architecture decision: Use a table instead of flex for the
            bottom section. Table cells stretch to the same height
            automatically — no overflow, no misalignment regardless of
            how much content is in either column.
        ══════════════════════════════════════════════════════════════════ */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: `2px solid ${BORDER_COLOR}` }}>
          <tbody>
            <tr style={{ verticalAlign: 'top' }}>

              {/* ── LEFT: Bank Details + Terms + QR ── */}
              <td style={{ width: '42%', padding: '20px 24px', borderRight: `2px solid ${BORDER_COLOR}`, background: '#fff' }}>

                {/* Bank Account Details */}
                {(company?.bankName || company?.accountNumber) && (
                  <div style={{ marginBottom: '16px', borderRadius: '6px', overflow: 'hidden', border: `1.5px solid ${PRIMARY_COLOR}` }}>
                    <div style={{ background: PRIMARY_COLOR, padding: '6px 12px' }}>
                      <span style={{ fontWeight: '800', fontSize: '10px', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        🏦 Bank Account Details
                      </span>
                    </div>
                    <div style={{ background: '#f0f5ff', padding: '10px 12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {[
                            { label: 'Bank Name',    value: company?.bankName },
                            { label: 'Account No',   value: company?.accountNumber, highlight: true },
                            { label: 'IFSC Code',    value: company?.ifscCode,      highlight: true },
                            { label: 'Branch',       value: company?.branchName },
                            { label: 'UPI ID',       value: company?.upiId },
                          ].filter(r => r.value).map(row => (
                            <tr key={row.label}>
                              <td style={{ padding: '3px 0', fontSize: '9.5px', color: TEXT_GRAY, fontWeight: '600', width: '90px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                {row.label}
                              </td>
                              <td style={{ padding: '3px 4px', fontSize: '9.5px', color: TEXT_GRAY, verticalAlign: 'top' }}>:</td>
                              <td style={{ padding: '3px 0 3px 4px', fontSize: '10px', color: row.highlight ? PRIMARY_COLOR : TEXT_DARK, fontWeight: row.highlight ? '900' : '700', verticalAlign: 'top', wordBreak: 'break-all' }}>
                                {row.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Terms and Conditions */}
                {(quotation.termsAndConditions || company?.termsAndConditions) && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '800', fontSize: '10px', marginBottom: '6px', color: TEXT_DARK, textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `2px solid ${PRIMARY_COLOR}`, paddingBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      📋 Terms and Conditions
                    </div>
                    <div style={{ fontSize: '9.5px', color: TEXT_DARK, lineHeight: '1.8', whiteSpace: 'pre-wrap', fontWeight: '500' }}>
                      {quotation.termsAndConditions || company?.termsAndConditions}
                    </div>
                  </div>
                )}

                {/* QR Code — rendered only once here */}
                {qrCodeUrl && (
                  <div style={{ marginTop: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', fontWeight: '800', color: TEXT_DARK, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Scan to Pay
                    </div>
                    <img
                      src={qrCodeUrl}
                      alt="Payment QR"
                      style={{ width: '90px', height: '90px', border: `1px solid ${BORDER_COLOR}`, borderRadius: '4px', padding: '4px', background: '#fff', display: 'block', margin: '0 auto' }}
                    />
                  </div>
                )}
              </td>

              {/* ── RIGHT: Totals ── */}
              <td style={{ width: '58%', padding: '0', background: '#fff', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <tbody>
                    {/* Fixed totals rows */}
                    {[
                      { label: 'Total',        value: quotation.subtotal,                                   bold: false },
                      { label: 'Discount (-)', value: quotation.totalDiscount,                              bold: false },
                      { label: 'Sub Total',    value: quotation.subtotal - quotation.totalDiscount,         bold: true  },
                      { label: 'Tax Amount',   value: quotation.totalGst,                                  bold: false },
                    ].map(({ label, value, bold }) => (
                      <tr key={label} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                        <td style={{ padding: '10px 14px', color: TEXT_GRAY, fontWeight: bold ? '800' : '700' }}>{label}</td>
                        <td style={{ padding: '10px 8px',  textAlign: 'center', color: TEXT_GRAY, fontWeight: '700', width: '20px' }}>:</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: bold ? '800' : '700', color: TEXT_DARK }}>
                          {fmtINR(value)}
                        </td>
                      </tr>
                    ))}

                    {/* Individual service lines */}
                    {!hideServiceCharges && (quotation.services || [])
                      .filter(sv => Number(sv.servicePrice) > 0)
                      .map((sv, idx) => {
                        const p = Number(sv.servicePrice) || 0;
                        const t = Number(sv.serviceTax)   || 0;
                        return (
                          <tr key={`svc-${idx}`} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                            <td style={{ padding: '8px 14px', color: TEXT_GRAY, fontWeight: '600', fontSize: '11px' }}>
                              {sv.serviceName || 'Service'}
                              {t > 0 && <span style={{ fontSize: '9px', marginLeft: '3px', color: TEXT_GRAY }}>({t}% tax)</span>}
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'center', color: TEXT_GRAY, fontWeight: '600', width: '20px' }}>:</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: '600', color: TEXT_DARK, fontSize: '11px' }}>
                              {fmtINR(p + p * t / 100)}
                            </td>
                          </tr>
                        );
                      })
                    }

                    {/* Service total (when 2+ services) */}
                    {!hideServiceCharges
                      && serviceTotal > 0
                      && (quotation.services || []).filter(sv => Number(sv.servicePrice) > 0).length > 1
                      && (
                        <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}`, background: '#f0f5ff' }}>
                          <td style={{ padding: '8px 14px', color: TEXT_DARK, fontWeight: '700', fontSize: '11px' }}>Service Total</td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: TEXT_GRAY, fontWeight: '700', width: '20px' }}>:</td>
                          <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: '700', color: TEXT_DARK, fontSize: '11px' }}>
                            {fmtINR(serviceTotal)}
                          </td>
                        </tr>
                      )
                    }

                    {/* Hidden services note */}
                    {hideServiceCharges && serviceTotal > 0 && (
                      <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                        <td colSpan={3} style={{ padding: '6px 14px', fontSize: '9px', color: TEXT_GRAY, fontStyle: 'italic' }}>
                          * Includes installation/service charges
                        </td>
                      </tr>
                    )}

                    {/* Final Total */}
                    <tr style={{ background: PRIMARY_COLOR }}>
                      <td style={{ padding: '14px 14px', color: '#fff', fontWeight: '800', fontSize: '14px' }}>Final Total</td>
                      <td style={{ padding: '14px 8px', color: '#fff', textAlign: 'center', fontWeight: '800', width: '20px' }}>:</td>
                      <td style={{ padding: '14px 14px', color: '#fff', fontWeight: '900', fontSize: '16px', textAlign: 'right' }}>
                        {fmtINR(grandTotal)}
                      </td>
                    </tr>

                    {/* Amount in words */}
                    <tr>
                      <td colSpan={3} style={{ padding: '12px 14px', background: LIGHT_BG, fontSize: '10.5px' }}>
                        <div style={{ fontWeight: '800', marginBottom: '4px', color: TEXT_DARK, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Invoice Total In Words:
                        </div>
                        <div style={{ color: TEXT_DARK, lineHeight: '1.5', fontWeight: '700', wordBreak: 'break-word' }}>
                          {numToWords(grandTotal)}
                        </div>
                      </td>
                    </tr>

                    {/* Logistics Summary removed — CBM data is internal only */}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ══ FOOTER ═══════════════════════════════════════════════════════ */}
        <div style={{
          background: PRIMARY_COLOR,
          padding: '16px 32px',
          textAlign: 'center',
          fontSize: '11px',
          color: '#fff',
          fontWeight: '600',
        }}>
          <div style={{ marginBottom: '4px', fontSize: '12px', fontWeight: '700' }}>Thank you for your business!</div>
          <div style={{ opacity: 0.9, fontSize: '10px' }}>
            {compName}
            {company?.phone && ` • ${company.phone}`}
            {company?.email && ` • ${company.email}`}
          </div>
        </div>

      </div>
    </div>
  );
});

QuotationPrintView.displayName = 'QuotationPrintView';
export default QuotationPrintView;
