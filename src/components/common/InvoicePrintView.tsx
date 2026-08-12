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
  'Rs. ' + new Intl.NumberFormat('en-IN').format(Math.round(n * 100) / 100);

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

  // Key flag — drives ALL layout differences between Invoice and Proforma Invoice
  const isProforma = invoice.documentType === 'PROFORMA_INVOICE';

  // GST breakdown — only used in Proforma layout
  const totalTax = invoice.totalTax ?? 0;
  const isInterState = (invoice as any).gstType === 'IGST';
  const igst = isInterState ? totalTax : 0;
  const sgst = isInterState ? 0 : totalTax / 2;
  const cgst = isInterState ? 0 : totalTax / 2;

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

        {/* ══ BILL TO + SHIP TO | INVOICE TITLE | DETAILS BOX ════════════════ */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: `2px solid ${BORDER_COLOR}`, marginBottom: '16px' }}>

          {/* Left: Bill To — original layout for Invoice; stacked with Ship To for Proforma */}
          <div style={{ flex: 1, padding: '14px 16px', borderRight: `2px solid ${BORDER_COLOR}` }}>
            {isProforma ? (
              /* Proforma: Bill To on top, Ship To stacked below for address space */
              <>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Bill To:</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: TEXT_DARK, marginBottom: '2px' }}>{invoice.customerName}</div>
                  {invoice.companyName && <div style={{ fontSize: '11px', color: TEXT_GRAY, fontWeight: '500' }}>{invoice.companyName}</div>}
                  {invoice.customerAddress && <div style={{ fontSize: '10px', color: TEXT_GRAY, marginTop: '3px', lineHeight: '1.6' }}>{invoice.customerAddress}</div>}
                </div>
                <div style={{ borderTop: `1px dashed ${BORDER_COLOR}`, paddingTop: '8px' }}>
                  <div style={{ fontSize: '9px', fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Ship To:</div>
                  <div style={{ fontSize: '10px', color: TEXT_DARK, fontWeight: '500', lineHeight: '1.6' }}>
                    {invoice.shippingAddress || invoice.customerAddress || invoice.customerName}
                  </div>
                </div>
              </>
            ) : (
              /* Normal Invoice: original Bill To layout */
              <>
                <div style={{ fontSize: '10px', color: TEXT_GRAY, marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Bill To:</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: TEXT_DARK, marginBottom: '4px' }}>{invoice.customerName}</div>
                {invoice.companyName && <div style={{ fontSize: '12px', color: TEXT_GRAY, fontWeight: '500' }}>{invoice.companyName}</div>}
              </>
            )}
          </div>

          {/* Center: title — original INVOICE style for normal, underlined black for Proforma */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 24px', borderRight: `2px solid ${BORDER_COLOR}`, minWidth: '160px' }}>
            <div style={{ textAlign: 'center' }}>
              {isProforma ? (
                <div style={{ fontSize: '26px', fontWeight: '900', color: TEXT_DARK, letterSpacing: '2px', textDecoration: 'underline', textDecorationColor: TEXT_DARK }}>
                  PROFORMA INVOICE
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '30px', fontWeight: '900', color: PRIMARY_COLOR, letterSpacing: '1.5px', textAlign: 'center', borderBottom: `4px solid ${PRIMARY_COLOR}`, paddingBottom: '6px' }}>
                    INVOICE
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Invoice Details */}
          <div style={{ padding: '14px 16px', minWidth: '220px', background: '#fff' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
              <tbody>
                <tr>
                  <td style={{ color: TEXT_GRAY, paddingBottom: '7px', paddingRight: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {isProforma ? 'P.I Invoice No:' : 'Invoice No:'}
                  </td>
                  <td style={{ fontWeight: '800', paddingBottom: '7px', color: PRIMARY_COLOR, fontSize: '12px' }}>{invoice.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style={{ color: TEXT_GRAY, paddingBottom: '7px', paddingRight: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}>Invoice Date:</td>
                  <td style={{ fontWeight: '700', paddingBottom: '7px', color: TEXT_DARK }}>{fmtDate(invoice.invoiceDate)}</td>
                </tr>
                <tr>
                  <td style={{ color: TEXT_GRAY, paddingBottom: '7px', paddingRight: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}>Due Date:</td>
                  <td style={{ fontWeight: '700', paddingBottom: '7px', color: TEXT_DARK }}>{fmtDate(invoice.dueDate)}</td>
                </tr>
                {isProforma && (
                  <tr>
                    <td style={{ color: TEXT_GRAY, paddingRight: '8px', fontWeight: '600', whiteSpace: 'nowrap' }}>Delivery:</td>
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
                <th style={thStyle(PRIMARY_COLOR, { width: '44px', textAlign: 'center' })}>Sr.No</th>
                <th style={thStyle(PRIMARY_COLOR, { textAlign: 'left' })}>Product Details</th>
                {isProforma && <th style={thStyle(PRIMARY_COLOR, { width: '68px', textAlign: 'center' })}>HSN/SAC</th>}
                <th style={thStyle(PRIMARY_COLOR, { width: isProforma ? '44px' : '55px', textAlign: 'center' })}>Qty</th>
                <th style={thStyle(PRIMARY_COLOR, { width: '95px', textAlign: 'right' })}>Unit Price</th>
                <th style={thStyle(PRIMARY_COLOR, { width: isProforma ? '65px' : '65px', textAlign: 'right' })}>Disc%</th>
                <th style={thStyle(PRIMARY_COLOR, { width: '95px', textAlign: 'right' })}>Tax</th>
                <th style={thStyle(PRIMARY_COLOR, { width: '105px', textAlign: 'right', borderRight: 'none' })}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : LIGHT_BG }}>
                  <td style={tdStyle({ textAlign: 'center', color: TEXT_GRAY, width: '44px', verticalAlign: 'middle', fontWeight: '600' })}>
                    {idx + 1}
                  </td>
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
                  {isProforma && (
                    <td style={tdStyle({ textAlign: 'center', verticalAlign: 'middle', width: '68px', color: TEXT_GRAY })}>
                      {item.hsnCode || '—'}
                    </td>
                  )}
                  <td style={tdStyle({ textAlign: 'center', verticalAlign: 'middle', width: isProforma ? '44px' : '55px', fontWeight: '600' })}>
                    {item.quantity}
                  </td>
                  <td style={tdStyle({ textAlign: 'right', verticalAlign: 'middle', width: '95px', fontWeight: '600' })}>
                    {fmtINR(item.unitPrice)}
                  </td>
                  <td style={tdStyle({ textAlign: 'right', verticalAlign: 'middle', width: '65px', color: TEXT_GRAY })}>
                    {item.discountPercentage ?? 0}%
                  </td>
                  <td style={tdStyle({ textAlign: 'right', verticalAlign: 'middle', width: '95px', fontWeight: '600' })}>
                    {fmtINR(item.taxAmount ?? 0)}
                  </td>
                  <td style={tdStyle({ textAlign: 'right', fontWeight: '800', verticalAlign: 'middle', width: '105px', borderRight: 'none', color: PRIMARY_COLOR, fontSize: '12px' })}>
                    {fmtINR(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ══ BOTTOM SECTION: Left info + Right totals ══════════════════════════ */}
        <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start' }}>

          {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
          <div style={{ flex: 1 }}>

            {/* Payment Terms — Proforma only */}
            {isProforma && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: '800', fontSize: '11px', color: TEXT_DARK, marginBottom: '4px' }}>Payment Terms:</div>
                <div style={{ fontSize: '10px', color: TEXT_GRAY, minHeight: '16px' }}>
                  {(invoice as any).paymentTerms || ''}
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
          </div>

          {/* ── RIGHT COLUMN: Totals ─────────────────────────────────────────── */}
          <div style={{ minWidth: '300px', flexShrink: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: `1px solid ${BORDER_COLOR}` }}>
              <tbody>
                {/* Subtotal */}
                <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                  <td style={{ padding: '8px 12px', color: TEXT_GRAY, fontWeight: '600' }}>Subtotal</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: TEXT_DARK }}>{fmtINR(invoice.subtotal)}</td>
                </tr>
                {/* Discount */}
                <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                  <td style={{ padding: '8px 12px', color: TEXT_GRAY, fontWeight: '600' }}>Discount (-)</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: TEXT_DARK }}>{fmtINR(invoice.totalDiscount ?? 0)}</td>
                </tr>

                {/* Tax Amount — breakdown only for Proforma */}
                <tr style={{ borderBottom: `1px solid ${BORDER_COLOR}` }}>
                  <td style={{ padding: '8px 12px', color: TEXT_GRAY, fontWeight: '600' }}>
                    <div>Tax Amount</div>
                    {isProforma && totalTax > 0 && (
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
                      {isProforma ? 'Amount in Words:' : 'Invoice Total In Words:'}
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
          </div>
        </div>

        {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
        <div style={{
          borderTop: `3px solid ${PRIMARY_COLOR}`,
          marginTop: '24px',
          paddingTop: '14px',
        }}>
          {isProforma ? (
            /* Proforma footer: FOR ___ line + Authorised Signatory */
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '11px', color: TEXT_DARK, fontWeight: '600', marginBottom: '6px' }}>
                  Thank you for your business!&nbsp;&nbsp;
                  <span style={{ fontWeight: '400', color: TEXT_GRAY }}>FOR</span>
                  <span style={{ display: 'inline-block', borderBottom: `1px solid ${TEXT_DARK}`, minWidth: '120px', marginLeft: '8px' }}>&nbsp;</span>
                </div>
                <div style={{ fontSize: '10px', color: TEXT_GRAY, fontWeight: '500' }}>
                  {compName}{company?.phone && ` • ${company.phone}`}{company?.email && ` • ${company.email}`}
                </div>
              </div>
              <div style={{ textAlign: 'center', minWidth: '140px' }}>
                <div style={{ borderTop: `1px solid ${TEXT_DARK}`, paddingTop: '6px', fontSize: '10px', color: TEXT_DARK, fontWeight: '600', letterSpacing: '0.5px' }}>
                  Authorised Signatory
                </div>
              </div>
            </div>
          ) : (
            /* Normal Invoice footer: original centered style */
            <div style={{ textAlign: 'center', fontSize: '10px', color: TEXT_GRAY, fontWeight: '500' }}>
              <div style={{ fontWeight: '700', fontSize: '11px', color: TEXT_DARK, marginBottom: '4px' }}>
                Thank you for your business!
              </div>
              <div style={{ opacity: 0.85 }}>
                {compName}{company?.phone && ` • ${company.phone}`}{company?.email && ` • ${company.email}`}
              </div>
            </div>
          )}
        </div>

      </div>{/* end z-index wrapper */}
    </div>
  );
});

InvoicePrintView.displayName = 'InvoicePrintView';
export default InvoicePrintView;
