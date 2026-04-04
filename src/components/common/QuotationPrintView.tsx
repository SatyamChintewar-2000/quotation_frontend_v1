import React from 'react';

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
}

interface QuotationData {
  id: string | number;
  quotationNumber?: string;
  clientName?: string;
  customerName?: string;
  customerPhone?: string;
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
  companyName?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

const QuotationPrintView = React.forwardRef<HTMLDivElement, Props>(
  ({ quotation, companyName = 'QuoteFlow' }, ref) => {
    const clientName = quotation.clientName || quotation.customerName || '—';
    const qNumber = quotation.quotationNumber || `#${quotation.id}`;
    const qDate = quotation.quotationDate || quotation.createdAt?.split('T')[0] || quotation.createdAt;

    return (
      <div
        ref={ref}
        style={{
          width: '794px',
          background: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          color: '#1a1a1a',
          padding: '40px',
          boxSizing: 'border-box',
        }}
      >
        {/* ── HEADER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f766e', letterSpacing: '-0.5px' }}>
              {companyName}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Professional Quotation</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>QUOTATION</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{qNumber}</div>
            <div style={{
              display: 'inline-block', marginTop: '8px',
              padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
              background: quotation.status === 'approved' ? '#d1fae5' : quotation.status === 'rejected' ? '#fee2e2' : '#fef3c7',
              color: quotation.status === 'approved' ? '#065f46' : quotation.status === 'rejected' ? '#991b1b' : '#92400e',
            }}>
              {quotation.status.toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div style={{ height: '3px', background: 'linear-gradient(to right, #0f766e, #14b8a6, #e5e7eb)', borderRadius: '2px', marginBottom: '24px' }} />

        {/* ── META INFO ── */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          {/* Bill To */}
          <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Bill To</div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>{clientName}</div>
            {quotation.customerPhone && <div style={{ color: '#6b7280', marginTop: '4px', fontSize: '12px' }}>{quotation.customerPhone}</div>}
          </div>
          {/* Quotation Details */}
          <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Quotation Details</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <tbody>
                {[
                  ['Date', qDate],
                  quotation.quotationCode ? ['Code', quotation.quotationCode] : null,
                  quotation.deliveryDate ? ['Delivery', quotation.deliveryDate] : null,
                  quotation.executiveName ? ['Executive', quotation.executiveName] : null,
                ].filter(Boolean).map(([label, value]) => (
                  <tr key={label as string}>
                    <td style={{ color: '#6b7280', paddingBottom: '4px', width: '80px' }}>{label}</td>
                    <td style={{ fontWeight: '600', color: '#111827', paddingBottom: '4px' }}>{value as string}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── PRODUCTS TABLE ── */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Products</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#0f766e' }}>
                {['#', 'Image', 'Product', 'Price', 'Qty', 'Disc%', 'Tax%', 'Total'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 12px', color: '#ffffff', fontWeight: '600',
                    fontSize: '11px', textAlign: h === '#' || h === 'Image' ? 'center' : h === 'Price' || h === 'Total' ? 'right' : 'center',
                    borderRight: '1px solid rgba(255,255,255,0.15)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, idx) => {
                const price = item.unitPrice ?? item.price ?? 0;
                const disc = item.discountPercentage ?? item.discount ?? 0;
                const tax = item.taxPercentage ?? item.gst ?? 0;
                const base = price * item.quantity;
                const afterDisc = base - base * disc / 100;
                const total = afterDisc + afterDisc * tax / 100;
                const imgSrc = item.imagePath || item.image;
                const name = item.productNameSnapshot || item.productName || '—';
                const isEven = idx % 2 === 0;

                return (
                  <tr key={idx} style={{ background: isEven ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280', fontSize: '12px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                      {imgSrc ? (
                        <img src={imgSrc} alt={name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'block', margin: '0 auto' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', background: '#e0f2fe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '18px' }}>📦</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#111827', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>₹{price.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{item.quantity}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{disc}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{tax}%</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f766e', borderBottom: '1px solid #e5e7eb' }}>₹{total.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── SERVICES TABLE ── */}
        {quotation.services && quotation.services.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Services</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#0f766e' }}>
                  {['Service Name', 'Price', 'Tax%', 'Total'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', color: '#fff', fontWeight: '600', fontSize: '11px', textAlign: h === 'Service Name' ? 'left' : 'right', borderRight: '1px solid rgba(255,255,255,0.15)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotation.services.map((s, idx) => {
                  const tax = s.servicePrice * s.serviceTax / 100;
                  const total = s.servicePrice + tax;
                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#111827', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{s.serviceName}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>₹{s.servicePrice.toFixed(2)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#374151', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>{s.serviceTax}%</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f766e', borderBottom: '1px solid #e5e7eb' }}>₹{total.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TOTALS ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div style={{ width: '280px', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {[
              { label: 'Subtotal', value: fmt(quotation.subtotal), bold: false },
              { label: 'Total Discount', value: `-${fmt(quotation.totalDiscount)}`, bold: false, red: true },
              { label: 'Total GST', value: fmt(quotation.totalGst), bold: false },
            ].map(({ label, value, bold, red }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>{label}</span>
                <span style={{ fontWeight: bold ? '700' : '500', color: red ? '#dc2626' : '#111827', fontSize: '12px' }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#0f766e' }}>
              <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '14px' }}>Grand Total</span>
              <span style={{ color: '#ffffff', fontWeight: '800', fontSize: '16px' }}>{fmt(quotation.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* ── NOTES & TERMS ── */}
        {(quotation.notes || quotation.termsAndConditions) && (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            {quotation.notes && (
              <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Notes</div>
                <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{quotation.notes}</div>
              </div>
            )}
            {quotation.termsAndConditions && (
              <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Terms & Conditions</div>
                <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>{quotation.termsAndConditions}</div>
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ height: '1px', background: '#e5e7eb', marginBottom: '16px' }} />
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af' }}>
          Thank you for your business! · Generated by {companyName}
        </div>
      </div>
    );
  }
);

QuotationPrintView.displayName = 'QuotationPrintView';
export default QuotationPrintView;
