import React, { useEffect, useState } from 'react';
import { companyService, Company } from '@/services/companyService';

interface QuotationItem {
  productId?: number;
  productName?: string;
  productNameSnapshot?: string;
  unitPrice?: number;
  price?: number;
  quantity: number;
  discountPercentage?: number;
  discount?: number;
  taxPercentage?: number;
  gst?: number;
  itemTotal?: number;
  subtotal?: number;
  imagePath?: string;
  image?: string;
  description?: string;
  productDescription?: string;
  productDescriptionSnapshot?: string;
}

interface QuotationData {
  id: string | number;
  quotationNumber?: string;
  clientName?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
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
}

interface Props {
  quotation: QuotationData;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const RED = '#cc0000';
const BORDER = `1px solid ${RED}`;

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtINR = (n: number) =>
  '₹ ' + new Intl.NumberFormat('en-IN').format(Math.round(n));

// Convert number to words (Indian system)
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWords(n: number): string {
  if (n === 0) return 'Zero';
  const num = Math.round(n);
  const inWords = (x: number): string => {
    if (x === 0) return '';
    if (x < 20) return ones[x] + ' ';
    if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '') + ' ';
    if (x < 1000) return ones[Math.floor(x / 100)] + ' Hundred ' + inWords(x % 100);
    if (x < 100000) return inWords(Math.floor(x / 1000)) + 'Thousand ' + inWords(x % 1000);
    if (x < 10000000) return inWords(Math.floor(x / 100000)) + 'Lac ' + inWords(x % 100000);
    return inWords(Math.floor(x / 10000000)) + 'Crore ' + inWords(x % 10000000);
  };
  return inWords(num).trim() + ' Only';
}

// ── shared cell styles ────────────────────────────────────────────────────────

const td = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '8px 10px',
  borderBottom: `1px solid #e0e0e0`,
  borderRight: `1px solid #e0e0e0`,
  fontSize: '11px',
  color: '#1a1a1a',
  verticalAlign: 'top',
  ...extra,
});

const th = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '9px 10px',
  background: RED,
  color: '#fff',
  fontWeight: '700',
  fontSize: '11px',
  borderRight: '1px solid rgba(255,255,255,0.25)',
  textAlign: 'center',
  ...extra,
});

// ── component ─────────────────────────────────────────────────────────────────

const QuotationPrintView = React.forwardRef<HTMLDivElement, Props>(({ quotation }, ref) => {
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    companyService.getMyCompany().then(setCompany).catch(() =>
      companyService.getAll().then(list => list.length && setCompany(list[0])).catch(() => {})
    );
  }, []);

  const clientName  = quotation.clientName || quotation.customerName || '—';
  const qNumber     = quotation.quotationNumber || `Q-${quotation.id}`;
  const qDate       = fmtDate(quotation.quotationDate || quotation.createdAt);
  const delivDate   = fmtDate(quotation.deliveryDate);
  const compName    = company?.companyName || 'Company';

  // totals
  const serviceTotal = (quotation.services || []).reduce((s, sv) => s + sv.servicePrice + sv.servicePrice * sv.serviceTax / 100, 0);
  const grandTotal   = quotation.grandTotal;

  return (
    <div
      ref={ref}
      style={{
        width: '794px',
        background: '#fff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        color: '#1a1a1a',
        boxSizing: 'border-box',
        padding: '24px',
      }}
    >

      {/* ══ HEADER BOX ══════════════════════════════════════════════════════ */}
      <div style={{ border: BORDER, borderRadius: '2px', marginBottom: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 18px' }}>
        {/* Left: company info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: '900', color: RED, letterSpacing: '0.5px', marginBottom: '5px' }}>
            {compName.toUpperCase()}
          </div>
          {company?.address && (
            <div style={{ fontSize: '10px', color: '#333', lineHeight: '1.7', maxWidth: '420px' }}>{company.address}</div>
          )}
          {company?.phone && <div style={{ fontSize: '10px', color: '#333', marginTop: '2px' }}>{company.phone}</div>}
          {company?.email && <div style={{ fontSize: '10px', color: '#333' }}>{company.email}</div>}
          {company?.gstNumber && (
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#1a1a1a', marginTop: '4px' }}>{company.gstNumber}</div>
          )}
        </div>
        {/* Right: logo */}
        {company?.logo && (
          <img
            src={company.logo}
            alt="logo"
            style={{ height: '80px', maxWidth: '150px', objectFit: 'contain', marginLeft: '16px', flexShrink: 0 }}
          />
        )}
      </div>

      {/* ══ TO + QUOTATION TITLE + DETAILS ══════════════════════════════════ */}
      <div style={{ border: BORDER, borderTop: 'none', display: 'flex', alignItems: 'stretch', marginBottom: '0' }}>
        {/* To block */}
        <div style={{ flex: 1, padding: '12px 18px', borderRight: BORDER }}>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>To :</div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#1a1a1a' }}>{clientName}</div>
          {quotation.customerPhone && (
            <div style={{ fontSize: '11px', color: '#555', marginTop: '3px' }}>| {quotation.customerPhone}</div>
          )}
          {quotation.customerAddress && (
            <div style={{ fontSize: '11px', color: '#555', marginTop: '3px' }}>{quotation.customerAddress}</div>
          )}
        </div>

        {/* QUOTATION title — center */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', borderRight: BORDER, minWidth: '160px' }}>
          <div style={{ fontSize: '20px', fontWeight: '900', textDecoration: 'underline', letterSpacing: '1px', color: '#1a1a1a' }}>QUOTATION</div>
        </div>

        {/* Quote details — right */}
        <div style={{ padding: '12px 18px', minWidth: '220px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
            <tbody>
              <tr>
                <td style={{ color: '#555', paddingBottom: '5px', paddingRight: '8px', whiteSpace: 'nowrap' }}>Quote No :</td>
                <td style={{ fontWeight: '800', paddingBottom: '5px', color: '#1a1a1a' }}>{qNumber}</td>
              </tr>
              <tr>
                <td style={{ color: '#555', paddingBottom: '5px', paddingRight: '8px' }}>Quote Date :</td>
                <td style={{ fontWeight: '800', paddingBottom: '5px', color: '#1a1a1a' }}>{qDate}</td>
              </tr>
              {quotation.deliveryDate && (
                <tr>
                  <td style={{ color: '#555', paddingRight: '8px' }}>Delivery Date :</td>
                  <td style={{ fontWeight: '800', color: '#1a1a1a' }}>{delivDate}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ PRODUCTS TABLE ══════════════════════════════════════════════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: BORDER, borderTop: 'none', marginBottom: '0' }}>
        <thead>
          <tr>
            <th style={th({ width: '44px' })}>Sr.No.</th>
            <th style={th({ width: '160px' })}>Product Image</th>
            <th style={th({ textAlign: 'left' })}>Product Details</th>
            <th style={th({ width: '76px' })}>M.R.P</th>
            <th style={th({ width: '80px' })}>Best Price</th>
            <th style={th({ width: '44px' })}>Qty</th>
            <th style={th({ width: '80px', borderRight: 'none' })}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {quotation.items.map((item, idx) => {
            const price    = item.unitPrice ?? item.price ?? 0;
            const disc     = item.discountPercentage ?? item.discount ?? 0;
            const tax      = item.taxPercentage ?? item.gst ?? 0;
            const base     = price * item.quantity;
            const afterDisc = base - base * disc / 100;
            const total    = afterDisc + afterDisc * tax / 100;
            const bestPrice = price - price * disc / 100;
            const imgSrc   = item.imagePath || item.image;
            const name     = item.productNameSnapshot || item.productName || '—';
            const desc     = item.productDescriptionSnapshot || item.productDescription || item.description || '';
            const isEven   = idx % 2 === 0;

            return (
              <tr key={idx} style={{ background: isEven ? '#fff' : '#fafafa' }}>
                {/* Sr No */}
                <td style={td({ textAlign: 'center', color: '#555', width: '44px', verticalAlign: 'middle' })}>{idx + 1}</td>

                {/* Image + name below */}
                <td style={td({ textAlign: 'center', width: '160px', padding: '12px 8px' })}>
                  {imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={name}
                      style={{ width: '130px', height: '130px', objectFit: 'contain', display: 'block', margin: '0 auto 6px' }}
                    />
                  ) : (
                    <div style={{ width: '130px', height: '130px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: '36px', borderRadius: '4px' }}>📦</div>
                  )}
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center' }}>{name}</div>
                </td>

                {/* Product details */}
                <td style={td({ verticalAlign: 'top', padding: '14px 12px' })}>
                  <div style={{ fontWeight: '800', fontSize: '12px', marginBottom: '5px', color: '#1a1a1a' }}>{compName}</div>
                  {desc && (
                    <div style={{ fontSize: '10.5px', color: '#333', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{desc}</div>
                  )}
                </td>

                {/* MRP */}
                <td style={td({ textAlign: 'right', width: '76px', verticalAlign: 'middle' })}>
                  {new Intl.NumberFormat('en-IN').format(price)}
                </td>

                {/* Best Price */}
                <td style={td({ textAlign: 'right', width: '80px', verticalAlign: 'middle' })}>
                  {new Intl.NumberFormat('en-IN').format(bestPrice)}
                </td>

                {/* Qty */}
                <td style={td({ textAlign: 'center', width: '44px', verticalAlign: 'middle' })}>{item.quantity}</td>

                {/* Amount */}
                <td style={td({ textAlign: 'right', fontWeight: '700', width: '80px', borderRight: 'none', verticalAlign: 'middle' })}>
                  {new Intl.NumberFormat('en-IN').format(Math.round(total))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ══ LAST ROW: Terms left + Totals right ═════════════════════════════ */}
      <div style={{ border: BORDER, borderTop: 'none', display: 'flex', alignItems: 'stretch' }}>

        {/* Left: Terms & Conditions */}
        <div style={{ flex: 1, padding: '16px 18px', borderRight: BORDER }}>
          {(quotation.termsAndConditions || company?.termsAndConditions) && (
            <>
              <div style={{ fontWeight: '800', fontSize: '12px', marginBottom: '8px', color: '#1a1a1a' }}>Terms and Conditions</div>
              <div style={{ fontSize: '10.5px', color: '#333', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {quotation.termsAndConditions || company?.termsAndConditions}
              </div>
            </>
          )}
          {quotation.notes && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontWeight: '700', fontSize: '11px', marginBottom: '4px', color: '#555' }}>Notes</div>
              <div style={{ fontSize: '10.5px', color: '#333', lineHeight: '1.7' }}>{quotation.notes}</div>
            </div>
          )}
        </div>

        {/* Right: Totals table */}
        <div style={{ minWidth: '280px', padding: '0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <tbody>
              {[
                { label: 'Total', value: quotation.subtotal },
                { label: 'Discount (-)', value: quotation.totalDiscount },
                { label: 'Sub Total', value: quotation.subtotal - quotation.totalDiscount },
                { label: 'Tax Amount', value: quotation.totalGst },
                { label: 'Service Charges', value: serviceTotal },
              ].map(({ label, value }) => (
                <tr key={label}>
                  <td style={{ padding: '7px 14px', borderBottom: '1px solid #e0e0e0', color: '#333', fontWeight: label === 'Sub Total' ? '700' : '400' }}>{label}</td>
                  <td style={{ padding: '7px 14px', borderBottom: '1px solid #e0e0e0', textAlign: 'center', color: '#555' }}>:</td>
                  <td style={{ padding: '7px 14px', borderBottom: '1px solid #e0e0e0', textAlign: 'right', fontWeight: '600', color: '#1a1a1a' }}>
                    {fmtINR(value)}
                  </td>
                </tr>
              ))}
              {/* Final Total */}
              <tr style={{ background: RED }}>
                <td style={{ padding: '10px 14px', color: '#fff', fontWeight: '800', fontSize: '13px' }}>Final Total</td>
                <td style={{ padding: '10px 14px', color: '#fff', textAlign: 'center' }}>:</td>
                <td style={{ padding: '10px 14px', color: '#fff', fontWeight: '900', fontSize: '14px', textAlign: 'right' }}>
                  {fmtINR(grandTotal)}
                </td>
              </tr>
              {/* Amount in words */}
              <tr>
                <td colSpan={3} style={{ padding: '10px 14px', borderTop: '1px solid #e0e0e0', fontSize: '10px' }}>
                  <div style={{ fontWeight: '700', marginBottom: '3px' }}>Invoice Total In Words :</div>
                  <div style={{ color: '#333', lineHeight: '1.5' }}>{numToWords(grandTotal)}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <div style={{ borderTop: `2px solid ${RED}`, marginTop: '16px', paddingTop: '10px', textAlign: 'center', fontSize: '10px', color: '#888' }}>
        Thank you for your business! · {compName}
        {company?.phone && ` · ${company.phone}`}
        {company?.email && ` · ${company.email}`}
      </div>

    </div>
  );
});

QuotationPrintView.displayName = 'QuotationPrintView';
export default QuotationPrintView;
