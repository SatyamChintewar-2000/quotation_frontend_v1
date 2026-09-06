import React, { useEffect, useState } from 'react';
import { companyService, Company } from '@/services/companyService';
import { Invoice } from '@/services/invoiceService';
import { useAuth } from '@/contexts/AuthContext';
import { getPdfTheme } from '@/constants/pdfThemes';

interface Props {
  invoice: Invoice;
}

// ── Color Scheme ────────────────────────────────────────────────────────────
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
  '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n * 100) / 100);

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

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

const thStyle = (primaryColor: string, extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '10px 8px',
  background: primaryColor,
  color: '#fff',
  fontWeight: '700',
  fontSize: '11px',
  borderRight: '1px solid rgba(255,255,255,0.2)',
  textAlign: 'center',
  ...extra,
});

const tdStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '10px 8px',
  borderBottom: `1px solid ${BORDER_COLOR}`,
  borderRight: `1px solid ${BORDER_COLOR}`,
  fontSize: '11px',
  color: TEXT_DARK,
  verticalAlign: 'top',
  ...extra,
});

const InvoicePrintView = React.forwardRef<HTMLDivElement, Props>(({ invoice }, ref) => {
  const [company, setCompany] = useState<Company | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const loadCompany = async () => {
      try {
        const c = await companyService.getMyCompany();
        setCompany(c);
      } catch {
        try {
          const list = await companyService.getAll();
          if (list.length > 0) {
            const matched = list.find(c =>
              c.companyName?.toLowerCase() === invoice.companyName?.toLowerCase()
            );
            setCompany(matched || list[0]);
          }
        } catch {
          // silent fail
        }
      }
    };
    loadCompany();
  }, [invoice.companyName]);

  const compName = company?.companyName || invoice.companyName || 'Company';
  const termsText = invoice.termsAndConditions || company?.termsAndConditions || '';
  const hasBankDetails = !!(company?.bankName || company?.accountNumber);

  const theme = getPdfTheme(company?.pdfThemeName, company?.pdfAccentColor);
  const PRIMARY_COLOR = theme.primaryColor;
  const LIGHT_BG = theme.lightBg;

  const showWatermark = !!(company?.pdfWatermarkEnabled && company?.logo);
  const watermarkOpacity = company?.pdfWatermarkOpacity ?? 0.07;

  // Key flags — drive ALL layout differences between document types
  const isProforma = invoice.documentType === 'PROFORMA_INVOICE';
  const isTaxInvoice = invoice.documentType === 'TAX_INVOICE';

  // GST breakdown — used in Proforma and Tax Invoice layouts
  const showGstBreakdown = isProforma || isTaxInvoice;
  const totalTax = invoice.totalTax ?? 0;
  const isInterState = (invoice as any).gstType === 'IGST';
  const igst = isInterState ? totalTax : 0;
  const sgst = isInterState ? 0 : totalTax / 2;
  const cgst = isInterState ? 0 : totalTax / 2;

  // Compute total discount from items when backend value is missing/zero
  const computedDiscount = (() => {
    const backendDiscount = Number(invoice.totalDiscount) || 0;
    if (backendDiscount > 0) return backendDiscount;
    return (invoice.items ?? []).filter(i => ((i as any).itemType || 'PRODUCT') !== 'SERVICE').reduce((sum, item) => {
      const base    = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1);
      const discAmt = Number(item.discountAmount) > 0
        ? Number(item.discountAmount)
        : base * (Number(item.discountPercentage) || 0) / 100;
      return sum + discAmt;
    }, 0);
  })();

  const computedSubtotal = (invoice.items ?? [])
    .filter(i => ((i as any).itemType || 'PRODUCT') !== 'SERVICE')
    .reduce((sum, item) => {
      return sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1);
    }, 0);

  // Taxable Amount = Subtotal − Discount
  const computedTaxableAmount = computedSubtotal - computedDiscount;
  return (
    <div
      ref={ref}
      style={{
        width: '794px',
        background: '#fff',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        fontSize: '12px',
        color: TEXT_DARK,
        boxSizing: 'border-box',
        padding: '28px 32px',
        position: 'relative',
      }}
    >
      {/* Watermark */}
      {showWatermark && company?.logo && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%) rotate(-20deg)',
          pointerEvents: 'none', zIndex: 0,
          width: '500px', height: '500px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img src={company!.logo!} alt="watermark"
            style={{ width: '500px', height: '500px', objectFit: 'contain', opacity: watermarkOpacity }} />
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
        <div style={{
          borderBottom: `3px solid ${PRIMARY_COLOR}`,
          paddingBottom: '16px',
          marginBottom: '0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          {company?.logo && (
            <div style={{ marginRight: '32px', flexShrink: 0 }}>
              <img src={company.logo} alt="logo"
                style={{ height: '80px', maxWidth: '200px', objectFit: 'contain', display: 'block' }} />
            </div>
          )}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: '900', color: PRIMARY_COLOR, letterSpacing: '0.5px', marginBottom: '8px' }}>
              {compName.toUpperCase()}
            </div>
            {company?.address && (
              <div style={{ fontSize: '10px', color: TEXT_DARK, lineHeight: '1.6', marginBottom: '6px', fontWeight: '500' }}>
                {company.address}
              </div>
            )}
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: '6px' }}>
              {company?.phone && <span style={{ fontSize: '10px', color: TEXT_DARK, fontWeight: '700' }}>Phone: {company.phone}</span>}
              {company?.email && <span style={{ fontSize: '10px', color: TEXT_DARK, fontWeight: '700' }}>Email: {company.email}</span>}
            </div>
            {company?.gstNumber && (
              <div style={{ fontSize: '10px', fontWeight: '700', color: TEXT_DARK }}>
                <span style={{ background: LIGHT_BG, padding: '4px 12px', borderRadius: '5px', border: `2px solid ${PRIMARY_COLOR}`, display: 'inline-block' }}>
                  GST: {company.gstNumber}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ══ BILL TO | SHIP TO | INVOICE TITLE | DETAILS BOX ═══════════════ */}
        <div style={{ display: 'flex', alignItems: 'stretch', border: `2px solid ${BORDER_COLOR}`, borderRadius: '6px', marginBottom: '16px', overflow: 'hidden' }}>

          {/* Bill To */}
          <div style={{ flex: 1, padding: '14px 16px', borderRight: `2px solid ${BORDER_COLOR}` }}>
            <div style={{ fontSize: '9px', fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Bill To:</div>
            <div style={{ fontSize: '17px', fontWeight: '800', color: TEXT_DARK, marginBottom: '4px' }}>{invoice.customerName}</div>
            {(invoice as any).customerPhone && (
              <div style={{ fontSize: '10px', color: TEXT_DARK, marginTop: '2px', fontWeight: '700' }}>📱 {(invoice as any).customerPhone}</div>
            )}
            {(invoice as any).customerEmail && (
              <div style={{ fontSize: '10px', color: TEXT_GRAY, marginTop: '2px' }}>✉ {(invoice as any).customerEmail}</div>
            )}
            {invoice.customerAddress && (
              <div style={{ fontSize: '10px', color: TEXT_GRAY, marginTop: '2px', lineHeight: '1.6' }}>{invoice.customerAddress}</div>
            )}
          </div>

          {/* Ship To — always shown, same column width as Bill To */}
          <div style={{ flex: 1, padding: '14px 16px', borderRight: `2px solid ${BORDER_COLOR}` }}>
            <div style={{ fontSize: '9px', fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Ship To:</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: TEXT_DARK, marginBottom: '4px' }}>{invoice.customerName}</div>
            <div style={{ fontSize: '10px', color: TEXT_GRAY, marginTop: '2px', lineHeight: '1.6' }}>
              {invoice.shippingAddress || invoice.customerAddress || '—'}
            </div>
          </div>

          {/* Center: title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 24px', borderRight: `2px solid ${BORDER_COLOR}`, minWidth: '160px' }}>
            <div style={{ textAlign: 'center' }}>
              {isProforma ? (
                <div style={{ fontSize: '22px', fontWeight: '900', color: TEXT_DARK, letterSpacing: '2px', textDecoration: 'underline', textDecorationColor: TEXT_DARK }}>
                  PROFORMA<br />INVOICE
                </div>
              ) : isTaxInvoice ? (
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#16a34a', letterSpacing: '2px', borderBottom: '4px solid #16a34a', paddingBottom: '6px' }}>
                  TAX INVOICE
                </div>
              ) : (
                <div style={{ fontSize: '30px', fontWeight: '900', color: PRIMARY_COLOR, letterSpacing: '1.5px', textAlign: 'center', borderBottom: `4px solid ${PRIMARY_COLOR}`, paddingBottom: '6px' }}>
                  INVOICE
                </div>
              )}
            </div>
          </div>

          {/* Right: Invoice Details */}
          <div style={{ padding: '14px 16px', minWidth: '220px', background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td style={{ color: TEXT_GRAY, paddingBottom: '7px', paddingRight: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {isProforma ? 'P.I No:' : isTaxInvoice ? 'Tax Invoice No:' : 'Invoice No:'}
                  </td>
                  <td style={{ fontWeight: '800', paddingBottom: '7px', color: PRIMARY_COLOR, fontSize: '12px' }}>{invoice.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style={{ color: TEXT_GRAY, paddingBottom: '7px', paddingRight: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}>Invoice Date:</td>
                  <td style={{ fontWeight: '700', paddingBottom: '7px', color: TEXT_DARK }}>{fmtDate(invoice.invoiceDate)}</td>
                </tr>
                <tr>
                  <td style={{ color: TEXT_GRAY, paddingBottom: '7px', paddingRight: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}>Valid Till :</td>
                  <td style={{ fontWeight: '700', paddingBottom: '7px', color: TEXT_DARK }}>{fmtDate(invoice.dueDate)}</td>
                </tr>
                {(isProforma || isTaxInvoice) && (
                  <tr>
                    <td style={{ color: TEXT_GRAY, paddingRight: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}>Expected Delivery Date:</td>
                    <td style={{ fontWeight: '600', color: TEXT_DARK }}>{invoice.deliveryDate ? fmtDate(invoice.deliveryDate) : '—'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══ ITEMS TABLE ═══════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '12px', fontWeight: '800', color: TEXT_DARK,
            marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px',
            borderBottom: `2px solid ${PRIMARY_COLOR}`, paddingBottom: '6px',
          }}>
            Product Details
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: `2px solid ${BORDER_COLOR}` }}>
            <thead>
              <tr>
                <th style={thStyle(PRIMARY_COLOR, { width: '36px', textAlign: 'center' })}>Sr.</th>
                <th style={thStyle(PRIMARY_COLOR, { textAlign: 'left' })}>Product / Description</th>
                {showGstBreakdown && <th style={thStyle(PRIMARY_COLOR, { width: '65px', textAlign: 'center' })}>HSN/SAC</th>}
                <th style={thStyle(PRIMARY_COLOR, { width: '80px', textAlign: 'right' })}>Unit Price (Rs.)</th>
                <th style={thStyle(PRIMARY_COLOR, { width: '36px', textAlign: 'center' })}>Qty</th>
                <th style={thStyle(PRIMARY_COLOR, { width: '70px', textAlign: 'right' })}>Disc. (Rs.)</th>
                <th style={thStyle(PRIMARY_COLOR, { width: '80px', textAlign: 'right' })}>Taxable (Rs.)</th>
                <th style={thStyle(PRIMARY_COLOR, { width: '40px', textAlign: 'center' })}>GST %</th>
                <th style={thStyle(PRIMARY_COLOR, { width: '88px', textAlign: 'right', borderRight: 'none' })}>Total (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.filter(item => ((item as any).itemType || 'PRODUCT') !== 'SERVICE').map((item, idx) => {
                const unitPrice   = Number(item.unitPrice) || 0;
                const qty         = Number(item.quantity)  || 1;
                const taxPct      = Number(item.taxPercentage) || 0;
                const base        = unitPrice * qty;
                // Use stored discountAmount first (exact), fall back to % calculation
                const discAmt     = Number(item.discountAmount) > 0
                  ? Number(item.discountAmount)
                  : base * (Number(item.discountPercentage) || 0) / 100;
                const taxableVal  = base - discAmt;
                const gstAmt      = Number(item.taxAmount) || (taxableVal * taxPct / 100);
                const total       = Number(item.total ?? item.itemTotal) || (taxableVal + gstAmt);
                const discPct     = Number(item.discountPercentage) || 0;
                return (
                <tr key={item.id ?? idx} style={{ background: idx % 2 === 0 ? '#fff' : LIGHT_BG, borderBottom: `1px solid ${BORDER_COLOR}`, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  {/* Sr. */}
                  <td style={tdStyle({ textAlign: 'center', color: TEXT_GRAY, width: '36px', verticalAlign: 'middle', fontWeight: '600' })}>
                    {idx + 1}
                  </td>
                  {/* Product / Description */}
                  <td style={tdStyle({ verticalAlign: 'top' })}>
                    <div style={{ fontWeight: '700', fontSize: '12px', color: TEXT_DARK, marginBottom: '3px' }}>
                      {item.productName}
                    </div>
                    {item.productDescription && (
                      <div style={{ fontSize: '10px', color: TEXT_GRAY, lineHeight: '1.5' }}>
                        {item.productDescription}
                      </div>
                    )}
                  </td>
                  {/* HSN/SAC — only for Tax Invoice / Proforma */}
                  {showGstBreakdown && (
                    <td style={tdStyle({ textAlign: 'center', verticalAlign: 'middle', width: '60px', color: TEXT_GRAY, fontSize: '10px' })}>
                      {item.hsnCode || '—'}
                    </td>
                  )}
                  {/* Unit Price */}
                  <td style={tdStyle({ textAlign: 'right', verticalAlign: 'middle', width: '80px', fontWeight: '600', color: TEXT_DARK })}>
                    {fmtINR(unitPrice)}
                  </td>
                  {/* Qty */}
                  <td style={tdStyle({ textAlign: 'center', verticalAlign: 'middle', width: '36px', fontWeight: '600' })}>
                    {qty}
                  </td>
                  {/* Discount (₹ total row, red) */}
                  <td style={tdStyle({ textAlign: 'right', verticalAlign: 'middle', width: '70px', color: discPct > 0 ? '#dc2626' : TEXT_GRAY, fontWeight: '600', fontSize: '11px' })}>
                    {discPct > 0 ? fmtINR(discAmt) : '—'}
                  </td>
                  {/* Taxable Value = (unit price − disc) × qty */}
                  <td style={tdStyle({ textAlign: 'right', verticalAlign: 'middle', width: '80px', fontWeight: '700', color: TEXT_DARK })}>
                    {fmtINR(taxableVal)}
                  </td>
                  {/* GST % */}
                  <td style={tdStyle({ textAlign: 'center', verticalAlign: 'middle', width: '40px', color: TEXT_GRAY, fontSize: '10px' })}>
                    {taxPct > 0 ? `${taxPct}%` : '—'}
                  </td>
                  {/* Total */}
                  <td style={tdStyle({ textAlign: 'right', fontWeight: '800', verticalAlign: 'middle', width: '88px', borderRight: 'none', color: PRIMARY_COLOR, fontSize: '12px' })}>
                    {fmtINR(total)}
                  </td>
                </tr>
                );
              })}
              {/* ── SERVICE CHARGE ROWS — removed; services now appear as
                  named rows in the right-side totals table (quotation style) ── */}
            </tbody>
          </table>
        </div>

        {/* ══ BOTTOM SECTION + FOOTER — kept together to prevent page-break splits ══ */}
        <div style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }} data-invoice-bottom="true">

        {/* Bottom Section: Left info + Right totals */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0' }}>
          <tbody>
            <tr style={{ verticalAlign: 'top' }}>

              {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
              <td style={{ paddingRight: '28px' }}>

                {/* Payment Terms */}
                {invoice.paymentTerms && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '800', fontSize: '11px', color: TEXT_DARK, marginBottom: '4px' }}>Payment Terms:</div>
                    <div style={{ fontSize: '10px', color: TEXT_GRAY, minHeight: '16px' }}>
                      {invoice.paymentTerms}
                    </div>
                  </div>
                )}

                {/* Bank Details */}
                {hasBankDetails && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '800', fontSize: '11px', color: TEXT_DARK, marginBottom: '6px' }}>
                      Bank Details:
                    </div>
                    <div style={{ fontSize: '10px', color: TEXT_DARK, lineHeight: '1.8' }}>
                      {company?.bankName && <div><strong>Bank:</strong> {company.bankName}</div>}
                      {company?.accountNumber && <div><strong>A/C No:</strong> {company.accountNumber}</div>}
                      {company?.ifscCode && <div><strong>IFSC:</strong> {company.ifscCode}</div>}
                      {company?.branchName && <div><strong>Branch:</strong> {company.branchName}</div>}
                      {company?.upiId && <div><strong>UPI:</strong> {company.upiId}</div>}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {invoice.notes && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '800', fontSize: '11px', color: TEXT_DARK, marginBottom: '4px' }}>
                      Note:
                    </div>
                    <div style={{ fontSize: '10px', color: TEXT_DARK, lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                      {invoice.notes}
                    </div>
                  </div>
                )}

                {/* Terms and Conditions */}
                {termsText && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontWeight: '800', fontSize: '11px', color: TEXT_DARK, marginBottom: '4px' }}>
                      Terms &amp; Conditions:
                    </div>
                    <div style={{ fontSize: '10px', color: TEXT_DARK, lineHeight: '1.9', whiteSpace: 'pre-wrap' }}>
                      {termsText}
                    </div>
                  </div>
                )}
              </td>

              {/* ── RIGHT COLUMN: Totals ─────────────────────────────────────── */}
              <td style={{ width: '300px', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: `1px solid ${BORDER_COLOR}` }}>
                  <tbody>
                    {/* Subtotal = unit price × qty before discount */}
                    <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                      <td style={{ padding: '8px 12px', color: TEXT_GRAY, fontWeight: '600' }}>Subtotal</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: TEXT_DARK }}>{fmtINR(computedSubtotal)}</td>
                    </tr>
                    <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                      <td style={{ padding: '8px 12px', color: TEXT_GRAY, fontWeight: '600' }}>Discount (-)</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: computedDiscount > 0 ? '#dc2626' : TEXT_DARK }}>{fmtINR(computedDiscount)}</td>
                    </tr>

                    {/* Taxable Amount = Subtotal − Discount */}
                    <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}`, background: '#f8faff' }}>
                      <td style={{ padding: '8px 12px', color: TEXT_DARK, fontWeight: '700' }}>Taxable Amount</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: TEXT_DARK }}>{fmtINR(computedTaxableAmount)}</td>
                    </tr>

                    {/* Tax Amount — breakdown for Proforma and Tax Invoice */}
                    <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                      <td style={{ padding: '8px 12px', color: TEXT_GRAY, fontWeight: '600' }}>
                        <div>Tax Amount</div>
                        {showGstBreakdown && totalTax > 0 && (
                          <div style={{ fontSize: '9px', color: TEXT_GRAY, marginTop: '2px', lineHeight: '1.6' }}>
                            {isInterState ? (
                              <span>IGST: {fmtINR(igst)}</span>
                            ) : (
                              <>
                                <span>SGST: {fmtINR(sgst)}</span><br />
                                <span>CGST: {fmtINR(cgst)}</span>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: TEXT_DARK, verticalAlign: 'top' }}>
                        {fmtINR(totalTax)}
                      </td>
                    </tr>

                    {/* Service Charges — one row per service, same as quotation */}
                    {(invoice.items ?? [])
                      .filter(i => (i as any).itemType === 'SERVICE')
                      .map((item, idx) => {
                        const p = Number(item.unitPrice) || 0;
                        const q = Number(item.quantity)  || 1;
                        const t = Number(item.taxPercentage) || 0;
                        const total = p * q + p * q * t / 100;
                        return (
                          <tr key={`svc-${idx}`} style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                            <td style={{ padding: '8px 12px', color: '#92400e', fontWeight: '600' }}>
                              {item.productName || 'Service'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#92400e' }}>
                              {fmtINR(total)}
                            </td>
                          </tr>
                        );
                      })
                    }

                    {/* Total Amount bar */}
                    <tr style={{ background: PRIMARY_COLOR }}>
                      <td style={{ padding: '12px 12px', color: '#fff', fontWeight: '800', fontSize: '13px' }}>
                        Total Amount
                      </td>
                      <td style={{ padding: '12px 12px', color: '#fff', fontWeight: '900', fontSize: '14px', textAlign: 'right' }}>
                        {fmtINR(invoice.totalAmount)}
                      </td>
                    </tr>

                    {/* Amount in Words */}
                    <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                      <td colSpan={2} style={{ padding: '10px 12px', background: LIGHT_BG, fontSize: '10px' }}>
                        <div style={{ fontWeight: '700', color: TEXT_GRAY, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                          {isProforma ? 'Amount in Words:' : isTaxInvoice ? 'Tax Invoice Total In Words:' : 'Invoice Total In Words:'}
                        </div>
                        <div style={{ color: TEXT_DARK, lineHeight: '1.5', fontWeight: '600', fontSize: '10px' }}>
                          {numToWords(invoice.totalAmount)}
                        </div>
                      </td>
                    </tr>

                    {/* Advance / Total Paid */}
                    <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                      <td style={{ padding: '8px 12px', color: TEXT_GRAY, fontWeight: '600' }}>
                        Advance / Total Paid
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#16a34a', fontSize: '12px' }}>
                        {fmtINR(invoice.totalPaid ?? 0)}
                      </td>
                    </tr>

                    {/* Balance Due */}
                    <tr>
                      <td style={{ padding: '8px 12px', color: TEXT_GRAY, fontWeight: '600' }}>
                        Balance Due
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#dc2626', fontSize: '13px' }}>
                        {fmtINR(invoice.remainingBalance ?? invoice.totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
        <div style={{
          borderTop: `3px solid ${PRIMARY_COLOR}`,
          marginTop: '24px',
          paddingTop: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontWeight: '700', fontSize: '12px', color: TEXT_DARK, marginBottom: '3px' }}>
            Thank you for your business — {compName}
          </div>
          <div style={{ fontSize: '9px', color: TEXT_GRAY, fontStyle: 'italic', opacity: 0.8 }}>
            This is a computer generated document. No signature is required.
          </div>
        </div>

        </div>{/* end pageBreakInside wrapper */}

      </div>{/* end z-index wrapper */}
    </div>
  );
});

InvoicePrintView.displayName = 'InvoicePrintView';
export default InvoicePrintView;
