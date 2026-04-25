import React, { useEffect, useState } from 'react';
import { companyService, Company } from '@/services/companyService';
import { Invoice } from '@/services/invoiceService';

interface Props {
  invoice: Invoice;
}

const RED = '#cc0000';

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtINR = (n: number) =>
  '₹ ' + new Intl.NumberFormat('en-IN').format(Math.round(n * 100) / 100);

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
    if (x < 10000000) return inWords(Math.floor(x / 100000)) + 'Lac ' + inWords(x % 100000);
    return inWords(Math.floor(x / 10000000)) + 'Crore ' + inWords(x % 10000000);
  };
  return inWords(num).trim() + ' Only';
}

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

const td = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '10px 10px',
  borderBottom: '1px solid #e0e0e0',
  borderRight: '1px solid #e0e0e0',
  fontSize: '11px',
  color: '#1a1a1a',
  verticalAlign: 'top',
  ...extra,
});

const BORDER = `1px solid ${RED}`;

const InvoicePrintView = React.forwardRef<HTMLDivElement, Props>(({ invoice }, ref) => {
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    companyService.getMyCompany().then(setCompany).catch(() =>
      companyService.getAll().then(list => list.length && setCompany(list[0])).catch(() => {})
    );
  }, []);

  const compName = company?.companyName || 'Company';

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
      {/* ── HEADER ── */}
      <div style={{ border: BORDER, borderRadius: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 18px', marginBottom: '0' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: '900', color: RED, letterSpacing: '0.5px', marginBottom: '5px' }}>
            {compName.toUpperCase()}
          </div>
          {company?.address && <div style={{ fontSize: '10px', color: '#333', lineHeight: '1.7', maxWidth: '420px' }}>{company.address}</div>}
          {company?.phone && <div style={{ fontSize: '10px', color: '#333', marginTop: '2px' }}>{company.phone}</div>}
          {company?.email && <div style={{ fontSize: '10px', color: '#333' }}>{company.email}</div>}
          {company?.gstNumber && <div style={{ fontSize: '10px', fontWeight: '700', color: '#1a1a1a', marginTop: '4px' }}>{company.gstNumber}</div>}
        </div>
        {company?.logo && (
          <img src={company.logo} alt="logo" style={{ height: '70px', maxWidth: '140px', objectFit: 'contain', marginLeft: '16px' }} />
        )}
      </div>

      {/* ── BILL TO + INVOICE TITLE + DETAILS ── */}
      <div style={{ border: BORDER, borderTop: 'none', display: 'flex', alignItems: 'stretch', marginBottom: '0' }}>
        <div style={{ flex: 1, padding: '12px 18px', borderRight: BORDER }}>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>Bill To :</div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#1a1a1a' }}>{invoice.customerName}</div>
          {invoice.companyName && <div style={{ fontSize: '11px', color: '#555', marginTop: '3px' }}>{invoice.companyName}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 24px', borderRight: BORDER, minWidth: '140px' }}>
          <div style={{ fontSize: '20px', fontWeight: '900', textDecoration: 'underline', letterSpacing: '1px', color: '#1a1a1a' }}>INVOICE</div>
        </div>
        <div style={{ padding: '12px 18px', minWidth: '220px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
            <tbody>
              <tr>
                <td style={{ color: '#555', paddingBottom: '5px', paddingRight: '8px', whiteSpace: 'nowrap' }}>Invoice No :</td>
                <td style={{ fontWeight: '800', paddingBottom: '5px', color: '#1a1a1a' }}>{invoice.invoiceNumber}</td>
              </tr>
              <tr>
                <td style={{ color: '#555', paddingBottom: '5px', paddingRight: '8px' }}>Invoice Date :</td>
                <td style={{ fontWeight: '800', paddingBottom: '5px', color: '#1a1a1a' }}>{fmtDate(invoice.invoiceDate)}</td>
              </tr>
              <tr>
                <td style={{ color: '#555', paddingRight: '8px' }}>Due Date :</td>
                <td style={{ fontWeight: '800', color: '#1a1a1a' }}>{fmtDate(invoice.dueDate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ITEMS TABLE ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: BORDER, borderTop: 'none', marginBottom: '0' }}>
        <thead>
          <tr>
            <th style={th({ width: '40px' })}>Sr.</th>
            <th style={th({ textAlign: 'left' })}>Product</th>
            <th style={th({ width: '44px' })}>Qty</th>
            <th style={th({ width: '80px' })}>Unit Price</th>
            <th style={th({ width: '60px' })}>Disc%</th>
            <th style={th({ width: '80px' })}>Tax</th>
            <th style={th({ width: '90px', borderRight: 'none' })}>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, idx) => (
            <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={td({ textAlign: 'center', color: '#888', width: '40px', verticalAlign: 'middle' })}>{idx + 1}</td>
              <td style={td({ verticalAlign: 'top' })}>
                <div style={{ fontWeight: '700', fontSize: '12px' }}>{item.productName}</div>
                {item.productDescription && (
                  <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>{item.productDescription}</div>
                )}
              </td>
              <td style={td({ textAlign: 'center', verticalAlign: 'middle', width: '44px' })}>{item.quantity}</td>
              <td style={td({ textAlign: 'right', verticalAlign: 'middle', width: '80px' })}>{fmtINR(item.unitPrice)}</td>
              <td style={td({ textAlign: 'center', verticalAlign: 'middle', width: '60px' })}>{item.discountPercentage ?? 0}%</td>
              <td style={td({ textAlign: 'right', verticalAlign: 'middle', width: '80px' })}>{fmtINR(item.taxAmount ?? 0)}</td>
              <td style={td({ textAlign: 'right', fontWeight: '700', verticalAlign: 'middle', width: '90px', borderRight: 'none' })}>{fmtINR(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TERMS + TOTALS ── */}
      <div style={{ border: BORDER, borderTop: 'none', display: 'flex', alignItems: 'stretch' }}>
        {/* Left: terms */}
        <div style={{ flex: 1, padding: '16px 18px', borderRight: BORDER }}>
          {(invoice.termsAndConditions || company?.termsAndConditions) && (
            <>
              <div style={{ fontWeight: '800', fontSize: '12px', marginBottom: '6px' }}>Terms and Conditions</div>
              <div style={{ fontSize: '10.5px', color: '#333', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {invoice.termsAndConditions || company?.termsAndConditions}
              </div>
            </>
          )}
          {invoice.notes && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontWeight: '700', fontSize: '11px', marginBottom: '3px', color: '#555' }}>Notes</div>
              <div style={{ fontSize: '10.5px', color: '#333', lineHeight: '1.7' }}>{invoice.notes}</div>
            </div>
          )}
        </div>

        {/* Right: totals */}
        <div style={{ minWidth: '280px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <tbody>
              {[
                { label: 'Subtotal', value: invoice.subtotal },
                { label: 'Discount', value: invoice.totalDiscount },
                { label: 'Tax Amount', value: invoice.totalTax },
              ].map(({ label, value }) => (
                <tr key={label}>
                  <td style={{ padding: '7px 14px', borderBottom: '1px solid #e0e0e0', color: '#333' }}>{label}</td>
                  <td style={{ padding: '7px 14px', borderBottom: '1px solid #e0e0e0', textAlign: 'center', color: '#555' }}>:</td>
                  <td style={{ padding: '7px 14px', borderBottom: '1px solid #e0e0e0', textAlign: 'right', fontWeight: '600' }}>{fmtINR(value ?? 0)}</td>
                </tr>
              ))}
              <tr style={{ background: RED }}>
                <td style={{ padding: '10px 14px', color: '#fff', fontWeight: '800', fontSize: '13px' }}>Total Amount</td>
                <td style={{ padding: '10px 14px', color: '#fff', textAlign: 'center' }}>:</td>
                <td style={{ padding: '10px 14px', color: '#fff', fontWeight: '900', fontSize: '14px', textAlign: 'right' }}>{fmtINR(invoice.totalAmount)}</td>
              </tr>
              <tr>
                <td colSpan={3} style={{ padding: '10px 14px', borderTop: '1px solid #e0e0e0', fontSize: '10px' }}>
                  <div style={{ fontWeight: '700', marginBottom: '3px' }}>Amount In Words :</div>
                  <div style={{ color: '#333', lineHeight: '1.5' }}>{numToWords(invoice.totalAmount)}</div>
                </td>
              </tr>
              {/* Payment status */}
              <tr>
                <td style={{ padding: '7px 14px', borderTop: '1px solid #e0e0e0', color: '#333' }}>Total Paid</td>
                <td style={{ padding: '7px 14px', borderTop: '1px solid #e0e0e0', textAlign: 'center', color: '#555' }}>:</td>
                <td style={{ padding: '7px 14px', borderTop: '1px solid #e0e0e0', textAlign: 'right', fontWeight: '600', color: '#16a34a' }}>{fmtINR(invoice.totalPaid ?? 0)}</td>
              </tr>
              <tr>
                <td style={{ padding: '7px 14px', borderTop: '1px solid #e0e0e0', color: '#333' }}>Balance Due</td>
                <td style={{ padding: '7px 14px', borderTop: '1px solid #e0e0e0', textAlign: 'center', color: '#555' }}>:</td>
                <td style={{ padding: '7px 14px', borderTop: '1px solid #e0e0e0', textAlign: 'right', fontWeight: '700', color: RED }}>{fmtINR(invoice.remainingBalance ?? invoice.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: `2px solid ${RED}`, marginTop: '16px', paddingTop: '10px', textAlign: 'center', fontSize: '10px', color: '#888' }}>
        Thank you for your business! · {compName}
        {company?.phone && ` · ${company.phone}`}
        {company?.email && ` · ${company.email}`}
      </div>
    </div>
  );
});

InvoicePrintView.displayName = 'InvoicePrintView';
export default InvoicePrintView;
