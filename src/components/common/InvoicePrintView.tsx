import React, { useEffect, useState } from 'react';
import { companyService, Company } from '@/services/companyService';
import { Invoice } from '@/services/invoiceService';
import { useAuth } from '@/contexts/AuthContext';
import { getPdfTheme } from '@/constants/pdfThemes';

interface Props {
  invoice: Invoice;
}

// ── Color Scheme ────────────────────────────────────────────────────────────
// PRIMARY_COLOR is now dynamic per company theme — defined inside the component
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

const th = (primaryColor: string) => (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '11px 10px',
  background: primaryColor,
  color: '#fff',
  fontWeight: '700',
  fontSize: '11px',
  borderRight: '1px solid rgba(255,255,255,0.2)',
  textAlign: 'center',
  ...extra,
});

const td = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '10px 10px',
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
    // Fix: Try getMyCompany first, fall back to getAll for SUPER_ADMIN/ADMIN with no company
    const loadCompany = async () => {
      try {
        const c = await companyService.getMyCompany();
        setCompany(c);
      } catch {
        try {
          // For SUPER_ADMIN or users without a company, get from invoice's company
          const list = await companyService.getAll();
          if (list.length > 0) {
            // Try to match invoice's company name
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

  // Feature 1: Resolve PDF theme from company settings
  const theme = getPdfTheme(company?.pdfThemeName, company?.pdfAccentColor);
  const PRIMARY_COLOR = theme.primaryColor;
  const LIGHT_BG = theme.lightBg;
  const thStyle = th(PRIMARY_COLOR);

  // Feature 1: Watermark
  const showWatermark = !!(company?.pdfWatermarkEnabled && company?.logo);
  const watermarkOpacity = company?.pdfWatermarkOpacity ?? 0.07;

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
        padding: '32px',
        position: 'relative',
      }}
    >
      {/* Feature 1: Watermark */}
      {showWatermark && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-20deg)',
          pointerEvents: 'none',
          zIndex: 0,
          width: '500px',
          height: '500px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={company!.logo!}
            alt="watermark"
            style={{
              width: '500px',
              height: '500px',
              objectFit: 'contain',
              opacity: watermarkOpacity,
            }}
          />
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div style={{
        borderBottom: `3px solid ${PRIMARY_COLOR}`,
        paddingBottom: '20px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        {company?.logo && (
          <div style={{ marginRight: '40px', flexShrink: 0 }}>
            <img
              src={company.logo}
              alt="logo"
              style={{ height: '100px', maxWidth: '240px', objectFit: 'contain', display: 'block' }}
            />
          </div>
        )}
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: '26px', fontWeight: '900', color: PRIMARY_COLOR, letterSpacing: '0.5px', marginBottom: '10px' }}>
            {compName.toUpperCase()}
          </div>
          {company?.address && (
            <div style={{ fontSize: '11px', color: TEXT_DARK, lineHeight: '1.7', marginBottom: '8px', fontWeight: '500' }}>
              {company.address}
            </div>
          )}
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: '8px' }}>
            {company?.phone && <div style={{ fontSize: '11px', color: TEXT_DARK, fontWeight: '700' }}>Phone: {company.phone}</div>}
            {company?.email && <div style={{ fontSize: '11px', color: TEXT_DARK, fontWeight: '700' }}>Email: {company.email}</div>}
          </div>
          {company?.gstNumber && (
            <div style={{ fontSize: '11px', fontWeight: '700', color: TEXT_DARK }}>
              <span style={{ background: LIGHT_BG, padding: '5px 14px', borderRadius: '6px', border: `2px solid ${PRIMARY_COLOR}`, display: 'inline-block' }}>
                GST: {company.gstNumber}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ══ BILL TO + INVOICE TITLE + DETAILS ═══════════════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', gap: '24px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: TEXT_GRAY, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Bill To:
          </div>
          <div style={{ fontSize: '17px', fontWeight: '800', color: TEXT_DARK, marginBottom: '4px' }}>
            {invoice.customerName}
          </div>
          {invoice.companyName && (
            <div style={{ fontSize: '12px', color: TEXT_GRAY, fontWeight: '500' }}>
              {invoice.companyName}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '160px' }}>
          <div style={{
            fontSize: '30px',
            fontWeight: '900',
            color: PRIMARY_COLOR,
            letterSpacing: '1.5px',
            textAlign: 'center',
            borderBottom: `4px solid ${PRIMARY_COLOR}`,
            paddingBottom: '6px',
          }}>
            INVOICE
          </div>
        </div>

        <div style={{ minWidth: '220px', background: LIGHT_BG, padding: '14px 18px', borderRadius: '8px', border: `2px solid ${BORDER_COLOR}` }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
            <tbody>
              <tr>
                <td style={{ color: TEXT_GRAY, paddingBottom: '7px', paddingRight: '10px', fontWeight: '600' }}>Invoice No:</td>
                <td style={{ fontWeight: '800', paddingBottom: '7px', color: PRIMARY_COLOR, fontSize: '12px' }}>{invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <td style={{ color: TEXT_GRAY, paddingBottom: '7px', paddingRight: '10px', fontWeight: '600' }}>Invoice Date:</td>
                <td style={{ fontWeight: '700', paddingBottom: '7px', color: TEXT_DARK }}>{fmtDate(invoice.invoiceDate)}</td>
              </tr>
              <tr>
                <td style={{ color: TEXT_GRAY, paddingRight: '10px', fontWeight: '600' }}>Due Date:</td>
                <td style={{ fontWeight: '700', color: TEXT_DARK }}>{fmtDate(invoice.dueDate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ ITEMS TABLE ═══════════════════════════════════════════════════════
          KEY FIX: No overflow hidden on table wrapper - let it expand fully.
          This prevents rows from being clipped when html2canvas captures.
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: '800',
          color: TEXT_DARK,
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: `2px solid ${PRIMARY_COLOR}`,
          paddingBottom: '7px',
        }}>
          Product Details
        </div>

        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: `2px solid ${BORDER_COLOR}`,
          // No border-radius with overflow:hidden - that clips rows at page breaks
        }}>
          <thead>
            <tr>
              <th style={thStyle({ width: '44px', textAlign: 'center' })}>Sr.No</th>
              <th style={thStyle({ textAlign: 'left' })}>Product Details</th>
              <th style={thStyle({ width: '55px', textAlign: 'right' })}>Qty</th>
              <th style={thStyle({ width: '95px', textAlign: 'right' })}>Unit Price</th>
              <th style={thStyle({ width: '65px', textAlign: 'right' })}>Disc%</th>
              <th style={thStyle({ width: '95px', textAlign: 'right' })}>Tax</th>
              <th style={thStyle({ width: '105px', textAlign: 'right', borderRight: 'none' })}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, idx) => (
              <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : LIGHT_BG }}>
                <td style={td({ textAlign: 'center', color: TEXT_GRAY, width: '44px', verticalAlign: 'middle', fontWeight: '600' })}>
                  {idx + 1}
                </td>
                <td style={td({ verticalAlign: 'top' })}>
                  <div style={{ fontWeight: '700', fontSize: '12px', color: TEXT_DARK, marginBottom: '3px' }}>
                    {item.productName}
                  </div>
                  {item.productDescription && (
                    <div style={{ fontSize: '10px', color: TEXT_GRAY, lineHeight: '1.5' }}>
                      {item.productDescription}
                    </div>
                  )}
                </td>
                <td style={td({ textAlign: 'right', verticalAlign: 'middle', width: '55px', fontWeight: '600' })}>
                  {item.quantity}
                </td>
                <td style={td({ textAlign: 'right', verticalAlign: 'middle', width: '95px', fontWeight: '600' })}>
                  {fmtINR(item.unitPrice)}
                </td>
                <td style={td({ textAlign: 'right', verticalAlign: 'middle', width: '65px', color: TEXT_GRAY })}>
                  {item.discountPercentage ?? 0}%
                </td>
                <td style={td({ textAlign: 'right', verticalAlign: 'middle', width: '95px', fontWeight: '600' })}>
                  {fmtINR(item.taxAmount ?? 0)}
                </td>
                <td style={td({ textAlign: 'right', fontWeight: '800', verticalAlign: 'middle', width: '105px', borderRight: 'none', color: PRIMARY_COLOR, fontSize: '12px' })}>
                  {fmtINR(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══ BOTTOM SECTION ════════════════════════════════════════════════════
          KEY FIX: Use block layout (not flex) so Bank Details and T&C stack
          vertically on the left, and totals sit on the right.
          No maxHeight / overflowY - content must be fully visible for html2canvas.
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', gap: '28px', alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN: Bank Details → T&C → Notes ─────────────────────── */}
        <div style={{ flex: 1 }}>

          {/* Bank Account Details */}
          {hasBankDetails && (
            <div style={{
              marginBottom: '16px',
              borderRadius: '6px',
              overflow: 'hidden',
              border: `1.5px solid ${PRIMARY_COLOR}`,
            }}>
              {/* Header */}
              <div style={{
                background: PRIMARY_COLOR,
                padding: '7px 14px',
              }}>
                <span style={{ fontWeight: '800', fontSize: '10px', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  🏦 Bank Account Details
                </span>
              </div>
              {/* Rows */}
              <div style={{ background: '#f0f5ff', padding: '12px 14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {company?.bankName && (
                      <tr>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, fontWeight: '600', width: '120px', verticalAlign: 'top' }}>Bank Name</td>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, width: '12px', verticalAlign: 'top' }}>:</td>
                        <td style={{ padding: '4px 0 4px 8px', fontSize: '10.5px', color: TEXT_DARK, fontWeight: '800', verticalAlign: 'top' }}>{company.bankName}</td>
                      </tr>
                    )}
                    {company?.accountNumber && (
                      <tr>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, fontWeight: '600', width: '120px', verticalAlign: 'top' }}>Account Number</td>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, width: '12px', verticalAlign: 'top' }}>:</td>
                        <td style={{ padding: '4px 0 4px 8px', fontSize: '11px', color: PRIMARY_COLOR, fontWeight: '900', letterSpacing: '0.5px', verticalAlign: 'top' }}>{company.accountNumber}</td>
                      </tr>
                    )}
                    {company?.ifscCode && (
                      <tr>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, fontWeight: '600', width: '120px', verticalAlign: 'top' }}>IFSC Code</td>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, width: '12px', verticalAlign: 'top' }}>:</td>
                        <td style={{ padding: '4px 0 4px 8px', fontSize: '11px', color: PRIMARY_COLOR, fontWeight: '900', letterSpacing: '1px', verticalAlign: 'top' }}>{company.ifscCode}</td>
                      </tr>
                    )}
                    {company?.branchName && (
                      <tr>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, fontWeight: '600', width: '120px', verticalAlign: 'top' }}>Branch</td>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, width: '12px', verticalAlign: 'top' }}>:</td>
                        <td style={{ padding: '4px 0 4px 8px', fontSize: '10.5px', color: TEXT_DARK, fontWeight: '800', verticalAlign: 'top' }}>{company.branchName}</td>
                      </tr>
                    )}
                    {company?.upiId && (
                      <tr>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, fontWeight: '600', width: '120px', verticalAlign: 'top' }}>UPI ID</td>
                        <td style={{ padding: '4px 0', fontSize: '10px', color: TEXT_GRAY, width: '12px', verticalAlign: 'top' }}>:</td>
                        <td style={{ padding: '4px 0 4px 8px', fontSize: '10.5px', color: TEXT_DARK, fontWeight: '800', verticalAlign: 'top' }}>{company.upiId}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Terms and Conditions */}
          {termsText && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontWeight: '800',
                fontSize: '10px',
                marginBottom: '7px',
                color: TEXT_DARK,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                borderBottom: `2px solid ${PRIMARY_COLOR}`,
                paddingBottom: '5px',
              }}>
                📋 Terms and Conditions
              </div>
              {/* KEY FIX: No maxHeight / overflowY - show all terms fully */}
              <div style={{ fontSize: '9.5px', color: TEXT_DARK, lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                {termsText}
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div>
              <div style={{
                fontWeight: '800',
                fontSize: '10px',
                marginBottom: '7px',
                color: TEXT_GRAY,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: `1px solid ${BORDER_COLOR}`,
                paddingBottom: '4px',
              }}>
                Notes
              </div>
              <div style={{ fontSize: '9.5px', color: TEXT_DARK, lineHeight: '1.7' }}>
                {invoice.notes}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Totals ─────────────────────────────────────────── */}
        <div style={{ minWidth: '320px', flexShrink: 0 }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
            border: `2px solid ${BORDER_COLOR}`,
          }}>
            <tbody>
              {[
                { label: 'Subtotal', value: invoice.subtotal },
                { label: 'Discount (-)', value: invoice.totalDiscount },
                { label: 'Tax Amount', value: invoice.totalTax },
              ].map(({ label, value }) => (
                <tr key={label}>
                  <td style={{ padding: '9px 14px', borderBottom: `1px solid ${BORDER_COLOR}`, color: TEXT_GRAY, fontWeight: '600' }}>
                    {label}
                  </td>
                  <td style={{ padding: '9px 14px', borderBottom: `1px solid ${BORDER_COLOR}`, textAlign: 'right', fontWeight: '700', color: TEXT_DARK }}>
                    {fmtINR(value ?? 0)}
                  </td>
                </tr>
              ))}

              {/* Grand Total */}
              <tr style={{ background: PRIMARY_COLOR }}>
                <td style={{ padding: '13px 14px', color: '#fff', fontWeight: '800', fontSize: '14px', letterSpacing: '0.5px' }}>
                  Total Amount
                </td>
                <td style={{ padding: '13px 14px', color: '#fff', fontWeight: '900', fontSize: '15px', textAlign: 'right' }}>
                  {fmtINR(invoice.totalAmount)}
                </td>
              </tr>

              {/* Amount in Words */}
              <tr>
                <td colSpan={2} style={{ padding: '12px 14px', borderTop: `2px solid ${BORDER_COLOR}`, fontSize: '10px', background: LIGHT_BG }}>
                  <div style={{ fontWeight: '700', marginBottom: '5px', color: TEXT_GRAY, textTransform: 'uppercase', fontSize: '9px', letterSpacing: '0.5px' }}>
                    Invoice Total In Words:
                  </div>
                  <div style={{ color: TEXT_DARK, lineHeight: '1.5', fontWeight: '600', fontSize: '10px' }}>
                    {numToWords(invoice.totalAmount)}
                  </div>
                </td>
              </tr>

              {/* Paid / Balance */}
              <tr>
                <td style={{ padding: '9px 14px', borderTop: `2px solid ${BORDER_COLOR}`, color: TEXT_GRAY, fontWeight: '600' }}>
                  Total Paid
                </td>
                <td style={{ padding: '9px 14px', borderTop: `2px solid ${BORDER_COLOR}`, textAlign: 'right', fontWeight: '700', color: '#16a34a', fontSize: '12px' }}>
                  {fmtINR(invoice.totalPaid ?? 0)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '9px 14px', borderTop: `1px solid ${BORDER_COLOR}`, color: TEXT_GRAY, fontWeight: '600' }}>
                  Balance Due
                </td>
                <td style={{ padding: '9px 14px', borderTop: `1px solid ${BORDER_COLOR}`, textAlign: 'right', fontWeight: '800', color: '#dc2626', fontSize: '13px' }}>
                  {fmtINR(invoice.remainingBalance ?? invoice.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ FOOTER ═════════════════════════════════════════════════════════════ */}
      <div style={{
        borderTop: `3px solid ${PRIMARY_COLOR}`,
        marginTop: '28px',
        paddingTop: '14px',
        textAlign: 'center',
        fontSize: '10px',
        color: TEXT_GRAY,
        fontWeight: '500',
      }}>
        <div style={{ fontWeight: '700', fontSize: '11px', color: TEXT_DARK, marginBottom: '4px' }}>
          Thank you for your business!
        </div>
        <div style={{ opacity: 0.85 }}>
          {compName}
          {company?.phone && ` • ${company.phone}`}
          {company?.email && ` • ${company.email}`}
        </div>
      </div>
    </div>{/* end z-index wrapper */}
    </div>
  );
});

InvoicePrintView.displayName = 'InvoicePrintView';
export default InvoicePrintView;
