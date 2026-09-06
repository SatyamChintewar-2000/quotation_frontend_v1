/**
 * Invoice PDF generator — pure jsPDF, no html2canvas.
 * Follows the exact same pattern as generateQuotationPdf.ts.
 * Proper row-level page breaks — content never cuts mid-row.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants (all in mm)
// ─────────────────────────────────────────────────────────────────────────────
const PW  = 210;
const PH  = 297;
const ML  = 10;
const MR  = 10;
const MT  = 10;
const MB  = 15;
const CW  = PW - ML - MR; // 190 mm
const PAD = 2;
const TH_H = 7; // table header height

// Table columns — all in mm, must sum to CW (190) for every combination
// Base column widths (used for normal invoice — no img, no hsn):
const I_SR   =  8;   // Sr.
const I_DET  = 68;   // Product / Description (base — widest when no img/hsn)
const I_IMG  = 22;   // Image column (proforma only — replaces DET space)
const I_HSN  = 14;   // HSN/SAC (tax/proforma only — replaces DET space)
const I_QTY  =  9;   // Qty
const I_UP   = 23;   // Unit Price
const I_DISC = 18;   // Discount
const I_TAX  = 21;   // Taxable Value
const I_GSTP = 11;   // GST %
const I_TOT  = 16;   // Total
// Verification — no img, no hsn: 8+68+9+23+18+21+11+16 = 174 ← need 190
// Δ = 16 → I_DET needs to be 84 for base case
// Recalculate: fixed right side = 8+9+23+18+21+11+16 = 106; so DET = 190-106 = 84
// Let's set I_DET=84 as base and subtract when img/hsn added:
// With HSN only:      DET = 84-14 = 70: 8+70+14+9+23+18+21+11+16 = 190 ✓
// With IMG only:      DET = 84-22 = 62: 8+22+62+9+23+18+21+11+16 = 190 ✓
// With IMG+HSN:       DET = 84-22-14=48: 8+22+48+14+9+23+18+21+11+16 = 190 ✓
const I_DET_BASE = 84; // effective DET = I_DET_BASE - (showImg?I_IMG:0) - (showHsn?I_HSN:0)
const IMG_SIZE = 18;  // image render size in mm
function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#1e3a8a').replace('#', '');
  const full  = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean.padEnd(6, '0');
  const n = parseInt(full, 16);
  if (isNaN(n)) return [30, 58, 138];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sf(pdf: any, r: number, g: number, b: number) { pdf.setFillColor(r, g, b); }
function sd(pdf: any, r: number, g: number, b: number) { pdf.setDrawColor(r, g, b); }
function st(pdf: any, r: number, g: number, b: number) { pdf.setTextColor(r, g, b); }

// ─────────────────────────────────────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d
    : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

const _ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const _tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function numToWords(n: number): string {
  if (n === 0) return 'Zero Only';
  const inW = (x: number): string => {
    if (!x) return '';
    if (x < 20)  return _ones[x] + ' ';
    if (x < 100) return _tens[Math.floor(x/10)] + (x%10 ? ' ' + _ones[x%10] : '') + ' ';
    if (x < 1e3)   return _ones[Math.floor(x/100)] + ' Hundred ' + inW(x%100);
    if (x < 1e5)   return inW(Math.floor(x/1e3)) + 'Thousand ' + inW(x%1e3);
    if (x < 1e7)   return inW(Math.floor(x/1e5)) + 'Lakh ' + inW(x%1e5);
    return inW(Math.floor(x/1e7)) + 'Crore ' + inW(x%1e7);
  };
  return inW(Math.round(n)).trim() + ' Only';
}

// ─────────────────────────────────────────────────────────────────────────────
// Image loader (same as quotation)
// ─────────────────────────────────────────────────────────────────────────────
async function loadImg(src: string): Promise<{ data: string; fmt: 'JPEG'|'PNG' }|null> {
  if (!src) return null;
  const fixed = src.includes('data:image/null')
    ? src.replace('data:image/null', 'data:image/jpeg')
    : src;
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve({ data: fixed, fmt: fixed.startsWith('data:image/png') ? 'PNG' : 'JPEG' });
    img.onerror = () => resolve(null);
    if (fixed.startsWith('data:')) img.src = fixed;
    else { img.crossOrigin = 'anonymous'; img.src = fixed; }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Image placeholder (same as quotation)
// ─────────────────────────────────────────────────────────────────────────────
function drawImgPlaceholder(pdf: any, x: number, y: number, rowH: number) {
  const boxW = 16, boxH = 12;
  const bx = x + (IMG_SIZE - boxW) / 2;
  const by = y + (rowH - boxH) / 2;
  sd(pdf, 220, 220, 220);
  sf(pdf, 250, 250, 250);
  pdf.setLineWidth(0.15);
  pdf.rect(bx, by, boxW, boxH, 'FD');
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'normal');
  st(pdf, 200, 200, 200);
  pdf.text('No Image', bx + boxW / 2, by + boxH / 2 + 1, { align: 'center' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Outer table borders
// ─────────────────────────────────────────────────────────────────────────────
function drawTableOuterBorders(pdf: any, topY: number, bottomY: number) {
  sd(pdf, 150, 150, 150);
  pdf.setLineWidth(0.4);
  pdf.line(ML,    topY,    ML,    bottomY);
  pdf.line(ML+CW, topY,    ML+CW, bottomY);
  pdf.line(ML,    bottomY, ML+CW, bottomY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Table header
// ─────────────────────────────────────────────────────────────────────────────
function drawTableHeader(
  pdf: any, y: number,
  primary: [number,number,number],
  showHsn: boolean,
  showImg: boolean,
): number {
  sf(pdf, ...primary);
  pdf.rect(ML, y, CW, TH_H, 'F');
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 255, 255, 255);

  // Effective DET width: base 62, add 24 if no img, add 16 if no hsn
  const effDet = I_DET_BASE - (showImg ? I_IMG : 0) - (showHsn ? I_HSN : 0);

  const cols: { lbl: string; x: number; w: number; al: string }[] = [];
  let cx = ML;
  cols.push({ lbl: 'Sr.', x: cx, w: I_SR, al: 'center' }); cx += I_SR;
  if (showImg) { cols.push({ lbl: 'Image', x: cx, w: I_IMG, al: 'center' }); cx += I_IMG; }
  cols.push({ lbl: 'Product / Description', x: cx, w: effDet, al: 'left' }); cx += effDet;
  if (showHsn) { cols.push({ lbl: 'HSN/SAC', x: cx, w: I_HSN, al: 'center' }); cx += I_HSN; }
  cols.push({ lbl: 'Unit Price (Rs.)',    x: cx, w: I_UP,   al: 'right'  }); cx += I_UP;
  cols.push({ lbl: 'Qty',          x: cx, w: I_QTY,  al: 'center' }); cx += I_QTY;
  cols.push({ lbl: 'Disc (Rs.)',      x: cx, w: I_DISC, al: 'right'  }); cx += I_DISC;
  cols.push({ lbl: 'Taxable (Rs.)', x: cx, w: I_TAX,  al: 'right'  }); cx += I_TAX;
  cols.push({ lbl: 'GST (%)',          x: cx, w: I_GSTP, al: 'center' }); cx += I_GSTP;
  cols.push({ lbl: 'Total (Rs.)',         x: cx, w: I_TOT,  al: 'right'  });

  for (const c of cols) {
    const tx = c.al === 'right'  ? c.x + c.w - PAD
             : c.al === 'center' ? c.x + c.w / 2
             : c.x + PAD;
    pdf.text(c.lbl, tx, y + TH_H - 2, { align: c.al as any });
  }
  return y + TH_H;
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw one product row — returns row height used
// ─────────────────────────────────────────────────────────────────────────────
function drawItemRow(
  pdf: any,
  y: number,
  srNo: number,
  productName: string,
  description: string,
  hsnCode: string,
  qty: number,
  unitPrice: number,
  discAmt: number,
  taxableVal: number,
  taxPct: number,
  total: number,
  showHsn: boolean,
  showImg: boolean,
  img: { data: string; fmt: 'JPEG'|'PNG' } | null,
  primary: [number,number,number],
  lightBg: [number,number,number],
  isEven: boolean,
): number {
  const effDet = I_DET_BASE - (showImg ? I_IMG : 0) - (showHsn ? I_HSN : 0);

  // Calculate row height based on text
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  const nameLines  = (pdf.splitTextToSize(productName || '—', effDet - PAD*2) as string[]).length;
  const descLines  = description ? (pdf.splitTextToSize(description, effDet - PAD*2) as string[]).length : 0;
  const textH = PAD + nameLines * 4.2 + (descLines ? 1.5 + descLines * 3.8 : 0) + PAD;
  const imgMinH = showImg ? IMG_SIZE + PAD * 2 : 0;
  const rowH  = Math.max(textH, imgMinH, 10);

  // Row background
  const [r, g, b] = isEven ? [255, 255, 255] : lightBg;
  sf(pdf, r, g, b);
  pdf.rect(ML, y, CW, rowH, 'F');

  // Row separator
  sd(pdf, 190, 190, 190);
  pdf.setLineWidth(0.25);
  pdf.line(ML, y + rowH, ML + CW, y + rowH);

  // Vertical column dividers
  sd(pdf, 210, 210, 210);
  pdf.setLineWidth(0.15);
  const xPositions: number[] = [];
  let vx = ML + I_SR;
  xPositions.push(vx);
  if (showImg) { vx += I_IMG; xPositions.push(vx); }
  vx += effDet; xPositions.push(vx);
  if (showHsn) { vx += I_HSN; xPositions.push(vx); }
  vx += I_UP;   xPositions.push(vx);
  vx += I_QTY;  xPositions.push(vx);
  vx += I_DISC; xPositions.push(vx);
  vx += I_TAX;  xPositions.push(vx);
  vx += I_GSTP; xPositions.push(vx);
  for (const px of xPositions) { pdf.line(px, y, px, y + rowH); }

  const midY = y + rowH / 2 + 1.2;

  // Sr.
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 55, 65, 81);
  pdf.text(String(srNo), ML + I_SR / 2, midY, { align: 'center' });

  // Image (proforma only)
  if (showImg) {
    const imgX = ML + I_SR + (I_IMG - IMG_SIZE) / 2;
    const imgY = y + (rowH - IMG_SIZE) / 2;
    if (img) {
      try { pdf.addImage(img.data, img.fmt, imgX, imgY, IMG_SIZE, IMG_SIZE); }
      catch { drawImgPlaceholder(pdf, ML + I_SR, y, rowH); }
    } else {
      drawImgPlaceholder(pdf, ML + I_SR, y, rowH);
    }
  }

  // Product name + description
  const detX = ML + I_SR + (showImg ? I_IMG : 0) + PAD;
  let ty = y + PAD + 3;
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 17, 24, 39);
  const nLines: string[] = pdf.splitTextToSize(productName || '—', effDet - PAD*2);
  for (const l of nLines) { pdf.text(l, detX, ty); ty += 4.2; }
  if (description) {
    ty += 1.5;
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    st(pdf, 75, 85, 99);
    const dLines: string[] = pdf.splitTextToSize(description, effDet - PAD*2);
    for (const l of dLines) { pdf.text(l, detX, ty); ty += 3.8; }
  }

  // Compute x for remaining columns — order: HSN | Unit Price | Qty | Disc | Taxable | GST | Total
  let cx = ML + I_SR + (showImg ? I_IMG : 0) + effDet;
  const hsnX  = showHsn ? cx + I_HSN / 2 : 0; if (showHsn) cx += I_HSN;
  const upX   = cx + I_UP - PAD;  cx += I_UP;
  const qtyX  = cx + I_QTY / 2;  cx += I_QTY;
  const discX = cx + I_DISC - PAD; cx += I_DISC;
  const taxX  = cx + I_TAX - PAD;  cx += I_TAX;
  const gstX  = cx + I_GSTP / 2;  cx += I_GSTP;
  const totX  = ML + CW - PAD;

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');

  // HSN/SAC — auto-shrink font if code is too wide for the column
  if (showHsn) {
    const hsnColW = I_HSN - PAD * 2;
    let hsnFontSize = 7;
    pdf.setFontSize(hsnFontSize);
    while (hsnFontSize > 5 && pdf.getTextWidth(hsnCode || '—') > hsnColW) {
      hsnFontSize -= 0.5;
      pdf.setFontSize(hsnFontSize);
    }
    st(pdf, 120, 80, 30);
    pdf.setFont('helvetica', 'normal');
    pdf.text(hsnCode || '—', hsnX, midY, { align: 'center' });
  }

  // Qty
  st(pdf, 17, 24, 39);
  pdf.setFont('helvetica', 'bold');
  pdf.text(String(qty), qtyX, midY, { align: 'center' });

  // Unit Price
  pdf.setFont('helvetica', 'normal');
  st(pdf, 107, 114, 128);
  pdf.text(new Intl.NumberFormat('en-IN').format(Math.round(unitPrice)), upX, midY, { align: 'right' });

  // Discount
  if (discAmt > 0) {
    st(pdf, 220, 38, 38);
    pdf.setFont('helvetica', 'bold');
    pdf.text(new Intl.NumberFormat('en-IN').format(Math.round(discAmt)), discX, midY, { align: 'right' });
  } else {
    st(pdf, 150, 150, 150);
    pdf.setFont('helvetica', 'normal');
    pdf.text('—', discX - 2, midY, { align: 'right' });
  }

  // Taxable Value
  pdf.setFont('helvetica', 'bold');
  st(pdf, 17, 24, 39);
  pdf.text(new Intl.NumberFormat('en-IN').format(Math.round(taxableVal)), taxX, midY, { align: 'right' });

  // GST%
  pdf.setFont('helvetica', 'normal');
  st(pdf, 107, 114, 128);
  pdf.text(taxPct > 0 ? `${taxPct}%` : '—', gstX, midY, { align: 'center' });

  // Total
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  st(pdf, ...primary);
  pdf.text(new Intl.NumberFormat('en-IN').format(Math.round(total)), totX, midY, { align: 'right' });

  return rowH;
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw page 1 header: company info + invoice title + bill-to + details
// Returns y after header
// ─────────────────────────────────────────────────────────────────────────────
async function drawInvoiceHeader(
  pdf: any,
  inv: any,
  company: any,
  logoImg: { data: string; fmt: 'JPEG'|'PNG' } | null,
  primary: [number,number,number],
): Promise<number> {
  let y = MT;
  const LOGO_W = 30, LOGO_H = 20;

  // Declare document type flags first
  const isProforma   = inv.documentType === 'PROFORMA_INVOICE';
  const isTaxInvoice = inv.documentType === 'TAX_INVOICE';

  // ── Logo (left) ───────────────────────────────────────────────────────────
  if (logoImg) {
    try { pdf.addImage(logoImg.data, logoImg.fmt, ML, y, LOGO_W, LOGO_H); } catch { /* skip */ }
  }

  // ── Invoice title (centre of header) ─────────────────────────────────────
  const titleLabel = isProforma ? 'PROFORMA INVOICE' : isTaxInvoice ? 'TAX INVOICE' : 'INVOICE';
  const [tr, tg, tb]: [number, number, number] = isTaxInvoice ? [22, 163, 74] : [...primary];
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  st(pdf, tr, tg, tb);
  pdf.text(titleLabel, PW / 2, y + 8, { align: 'center' });
  sd(pdf, tr, tg, tb);
  pdf.setLineWidth(0.7);
  // Measure actual text width for accurate underline
  const titleWidth = pdf.getTextWidth(titleLabel);
  pdf.line(PW/2 - titleWidth/2, y + 10.5, PW/2 + titleWidth/2, y + 10.5);

  // ── Company name + details (right) ───────────────────────────────────────
  // Right column occupies roughly half the page width (from centre to right margin)
  const compColW = PW / 2 - MR - 2; // ~93mm available for right-side text

  // Auto-shrink company name to fit within the right column
  let compNameSize = 10;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(compNameSize);
  const compNameStr = (company.companyName || '').toUpperCase();
  while (compNameSize > 7 && pdf.getTextWidth(compNameStr) > compColW) {
    compNameSize -= 0.5;
    pdf.setFontSize(compNameSize);
  }
  st(pdf, ...primary);
  pdf.text(compNameStr, PW - MR, y + 5, { align: 'right' });

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  st(pdf, 55, 65, 81);
  let ry = y + 10;
  if (company.address) {
    // Use actual right-column width so text wraps instead of overflowing
    const al: string[] = pdf.splitTextToSize(company.address, compColW);
    for (const l of al) { pdf.text(l, PW - MR, ry, { align: 'right' }); ry += 3.5; }
  }
  const contact = [company.phone && `Phone: ${company.phone}`, company.email && `Email: ${company.email}`]
    .filter(Boolean).join('   ');
  if (contact) { pdf.text(contact, PW - MR, ry, { align: 'right' }); ry += 3.5; }
  if (company.gstNumber) {
    pdf.setFont('helvetica', 'bold');
    pdf.text(`GST: ${company.gstNumber}`, PW - MR, ry, { align: 'right' });
    ry += 3.5;
  }

  y = Math.max(y + LOGO_H, ry) + 2;

  // Primary separator line
  sf(pdf, ...primary);
  pdf.rect(ML, y, CW, 1.5, 'F');
  y += 5;

  // ── Info box: Bill To | Ship To | Invoice details ────────────────────────
  // Ship To is always shown for Proforma and Tax Invoice;
  // for normal Invoice it is shown only when a shipping address is explicitly set.
  const hasShipping = !!(inv.shippingAddress && inv.shippingAddress.trim());
  const showShipCol = isProforma || isTaxInvoice || hasShipping;
  const shipAddr    = inv.shippingAddress?.trim() || inv.customerAddress || inv.customerName || '—';

  const pad  = 4;

  // Column widths
  const detW  = 68; // invoice details column (right)
  const shipW = showShipCol ? 54 : 0;
  const billW = CW - detW - shipW;

  // ── Pre-measure content heights to make the box fully dynamic ────────────
  // Bill To column height
  pdf.setFontSize(7);
  let billH = 5 + 7; // "BILL TO:" label (5) + customer name (7, font-10 ≈ 7mm)
  if (inv.customerPhone) billH += 3.5;
  if (inv.customerEmail) billH += 3.5;
  if (inv.customerAddress) {
    pdf.setFontSize(7);
    const addrLines: string[] = pdf.splitTextToSize(inv.customerAddress, billW - pad * 2);
    billH += addrLines.length * 3.5;
  }
  billH += pad; // bottom padding

  // Ship To column height
  let shipH = 0;
  if (showShipCol) {
    pdf.setFontSize(7);
    const sl: string[] = pdf.splitTextToSize(shipAddr, shipW - pad * 2);
    shipH = 5 + 6 + 4.5 + sl.length * 3.5 + pad; // label + name + gap + lines + bottom pad
  }

  // Details column height — fixed rows (always ≥ 3, optionally 4 with delivery)
  const detRowCount = inv.deliveryDate ? 4 : 3;
  const detH = 8 + detRowCount * 8 + pad;

  // Final box height = tallest column, minimum 32
  const secH = Math.max(billH, shipH, detH, 32);
  const secY = y;

  sd(pdf, ...primary);
  pdf.setLineWidth(0.5);
  pdf.rect(ML, secY, CW, secH, 'S');

  // Vertical dividers — full dynamic height
  pdf.setLineWidth(0.4);
  if (showShipCol) {
    pdf.line(ML + billW,          secY, ML + billW,          secY + secH);
    pdf.line(ML + billW + shipW,  secY, ML + billW + shipW,  secY + secH);
  } else {
    pdf.line(ML + billW, secY, ML + billW, secY + secH);
  }

  // ── BILL TO ────────────────────────────────────────────────────────────
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 107, 114, 128);
  pdf.text('BILL TO:', ML + pad, secY + 5);
  pdf.setFontSize(10);
  st(pdf, 17, 24, 39);
  pdf.text(inv.customerName || '—', ML + pad, secY + 12);
  let by = secY + 18;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  if (inv.customerPhone) {
    st(pdf, 17, 24, 39);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Ph: ${inv.customerPhone}`, ML + pad, by); by += 3.5;
    pdf.setFont('helvetica', 'normal');
  }
  if (inv.customerEmail) {
    st(pdf, 107, 114, 128);
    pdf.text(inv.customerEmail, ML + pad, by); by += 3.5;
  }
  if (inv.customerAddress) {
    st(pdf, 107, 114, 128);
    const al: string[] = pdf.splitTextToSize(inv.customerAddress, billW - pad * 2);
    for (const l of al) { pdf.text(l, ML + pad, by); by += 3.5; }
  }

  // ── SHIP TO (always shown for Proforma/Tax Invoice) ────────────────────
  if (showShipCol) {
    const sx = ML + billW + pad;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    st(pdf, 107, 114, 128);
    pdf.text('SHIP TO:', sx, secY + 5);
    // Customer name (bold)
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    st(pdf, 17, 24, 39);
    pdf.text(inv.customerName || '—', sx, secY + 11);
    // Address lines
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    st(pdf, 107, 114, 128);
    let sy = secY + 15.5;
    const sl: string[] = pdf.splitTextToSize(shipAddr, shipW - pad * 2);
    for (const l of sl) { pdf.text(l, sx, sy); sy += 3.5; }
  }

  // ── INVOICE DETAILS (right column) ────────────────────────────────────
  const dx = ML + billW + shipW + pad;
  const rw = detW - pad * 2;
  const invNoLabel = isProforma ? 'P.I No:' : isTaxInvoice ? 'Tax Inv No:' : 'Invoice No:';

  // Space detail rows evenly inside the box
  const detRows: { label: string; value: string }[] = [
    { label: invNoLabel,    value: inv.invoiceNumber || '—' },
    { label: isProforma ? 'P.I Date:' : 'Invoice Date:', value: fmtDate(inv.invoiceDate) },
    { label: 'Valid Till:', value: fmtDate(inv.dueDate) },
  ];
  if (inv.deliveryDate) {
    detRows.push({ label: 'Delivery Date:', value: fmtDate(inv.deliveryDate) });
  }
  const detRowSpacing = (secH - pad) / (detRows.length + 0.5);
  pdf.setFontSize(7.5);
  detRows.forEach((row, i) => {
    const rowY = secY + pad + (i + 0.8) * detRowSpacing;
    pdf.setFont('helvetica', 'bold');
    st(pdf, 107, 114, 128);
    pdf.text(row.label, dx, rowY);
    if (i === 0) {
      st(pdf, ...primary);
    } else {
      st(pdf, 17, 24, 39);
    }
    pdf.text(row.value, dx + rw, rowY, { align: 'right' });
  });

  y = secY + secH + 6;
  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw summary + footer
// ─────────────────────────────────────────────────────────────────────────────
function drawInvoiceSummary(
  pdf: any,
  startY: number,
  inv: any,
  company: any,
  primary: [number,number,number],
  lightBg: [number,number,number],
  computedSubtotal: number,
  computedDiscount: number,
  computedTaxableAmount: number,
  totalTax: number,
  isProforma: boolean,
  isTaxInvoice: boolean,
  isInterState: boolean,
  qrImg: { data: string; fmt: 'PNG'|'JPEG' } | null,
) {
  const leftW  = 80;
  const rightX = ML + leftW + 4;
  const rightW = CW - leftW - 4;

  sd(pdf, 209, 213, 219);
  pdf.setLineWidth(0.3);
  pdf.line(ML, startY, ML + CW, startY);
  let y = startY + 4;
  let ly = y, ry = y;

  // ── LEFT: Payment Terms ────────────────────────────────────────────────
  if (inv.paymentTerms) {
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    st(pdf, 17, 24, 39);
    pdf.text('PAYMENT TERMS', ML, ly + 4);
    sf(pdf, ...primary);
    pdf.rect(ML, ly + 5.2, 28, 0.5, 'F');
    ly += 8;
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    st(pdf, 55, 65, 81);
    const ptl: string[] = pdf.splitTextToSize(inv.paymentTerms, leftW - 2);
    for (const l of ptl) { pdf.text(l, ML, ly); ly += 3.5; }
    ly += 3;
  }

  // ── LEFT: Bank details ─────────────────────────────────────────────────
  if (company.bankName || company.accountNumber) {
    sf(pdf, ...primary);
    pdf.rect(ML, ly, leftW, 6.5, 'F');
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    st(pdf, 255, 255, 255);
    pdf.text('BANK ACCOUNT DETAILS', ML + 2, ly + 4.5);
    ly += 6.5;

    const bankRows = [
      ['Bank Name',  company.bankName],
      ['Account No', company.accountNumber],
      ['IFSC Code',  company.ifscCode],
      ['Branch',     company.branchName],
      ['UPI ID',     company.upiId],
    ].filter(r => r[1]) as [string, string][];

    sf(pdf, 240, 245, 255);
    pdf.rect(ML, ly, leftW, bankRows.length * 4.5 + 2, 'F');
    sd(pdf, 199, 210, 253);
    pdf.setLineWidth(0.3);
    pdf.rect(ML, ly - 6.5, leftW, bankRows.length * 4.5 + 2 + 6.5, 'S');

    let by2 = ly + 3.5;
    for (const [lbl, val] of bankRows) {
      pdf.setFontSize(6.5);
      pdf.setFont('helvetica', 'bold');
      st(pdf, 107, 114, 128);
      pdf.text(lbl, ML + 2, by2);
      pdf.setFont('helvetica', 'normal');
      st(pdf, 17, 24, 39);
      pdf.text(`: ${val}`, ML + 22, by2);
      by2 += 4.5;
    }
    ly = by2 + 2;
  }

  // ── LEFT: Notes ────────────────────────────────────────────────────────
  if (inv.notes) {
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    st(pdf, 17, 24, 39);
    pdf.text('NOTES', ML, ly + 4);
    ly += 7;
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    st(pdf, 55, 65, 81);
    const nl: string[] = pdf.splitTextToSize(inv.notes, leftW - 2);
    for (const l of nl) { pdf.text(l, ML, ly); ly += 3.5; }
    ly += 3;
  }

  // ── LEFT: Terms ────────────────────────────────────────────────────────
  const terms = inv.termsAndConditions || company.termsAndConditions;
  if (terms) {
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    st(pdf, 17, 24, 39);
    pdf.text('TERMS & CONDITIONS', ML, ly + 4);
    sf(pdf, ...primary);
    pdf.rect(ML, ly + 5.2, 32, 0.5, 'F');
    ly += 8;
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    st(pdf, 55, 65, 81);
    const tl: string[] = pdf.splitTextToSize(terms, leftW - 2);
    for (const l of tl) { pdf.text(l, ML, ly); ly += 3.5; }
    ly += 3;
  }

  // ── LEFT: QR code (if UPI available) ──────────────────────────────────
  if (qrImg) {
    try {
      pdf.addImage(qrImg.data, qrImg.fmt, ML, ly, 22, 22);
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      st(pdf, 55, 65, 81);
      pdf.text('Scan to Pay', ML + 11, ly + 24, { align: 'center' });
      ly += 27;
    } catch { /* skip */ }
  }

  // ── RIGHT: Totals ──────────────────────────────────────────────────────
  const igst = isInterState ? totalTax : 0;
  const sgst = isInterState ? 0 : totalTax / 2;
  const cgst = isInterState ? 0 : totalTax / 2;
  const showGstBreakdown = isProforma || isTaxInvoice;

  const totRows: { lbl: string; val: number | null; bold?: boolean; red?: boolean; amber?: boolean; sub?: string }[] = [
    { lbl: 'Subtotal (Rs.)',        val: computedSubtotal },
    { lbl: 'Discount (Rs.)',        val: computedDiscount,       red: computedDiscount > 0 },
    { lbl: 'Taxable Amount (Rs.)',  val: computedTaxableAmount,  bold: true },
    {
      lbl: 'Tax Amount (Rs.)',
      val: totalTax,
      sub: showGstBreakdown && totalTax > 0
        ? (isInterState ? `IGST: ${fmtINR(igst)}` : `SGST: ${fmtINR(sgst)}  CGST: ${fmtINR(cgst)}`)
        : undefined,
    },
  ];

  // Add each service charge as its own named row — same pattern as quotation PDF
  const svcItems: any[] = (inv.items || []).filter((it: any) => it.itemType === 'SERVICE');
  for (const svc of svcItems) {
    const p = Number(svc.unitPrice) || 0;
    const q = Number(svc.quantity)  || 1;
    const t = Number(svc.taxPercentage) || 0;
    totRows.push({ lbl: svc.productName || 'Service', val: p * q + p * q * t / 100, amber: true });
  }

  for (const row of totRows) {
    const rowH = row.sub ? 10 : 7;
    sd(pdf, 229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.line(rightX, ry + rowH, rightX + rightW, ry + rowH);

    pdf.setFontSize(row.bold ? 8 : 7.5);
    pdf.setFont('helvetica', row.bold ? 'bold' : 'normal');
    const [tr, tg, tb] = row.red ? [220, 38, 38] : row.amber ? [146, 64, 14] : row.bold ? [17, 24, 39] : [107, 114, 128];
    st(pdf, tr, tg, tb);
    pdf.text(row.lbl, rightX + 2, ry + 5);
    pdf.text(':', rightX + rightW / 2, ry + 5, { align: 'center' });
    if (row.val !== null) {
      pdf.text(fmtINR(row.val!), rightX + rightW - 2, ry + 5, { align: 'right' });
    }
    if (row.sub) {
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      st(pdf, 107, 114, 128);
      pdf.text(row.sub, rightX + 2, ry + 9);
    }
    ry += rowH;
  }

  // Total Amount bar
  sf(pdf, ...primary);
  pdf.rect(rightX, ry, rightW, 10, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 255, 255, 255);
  pdf.text('Total Amount (Rs.)', rightX + 2, ry + 7);
  pdf.text(':', rightX + rightW / 2, ry + 7, { align: 'center' });
  pdf.text(fmtINR(inv.totalAmount || 0), rightX + rightW - 2, ry + 7, { align: 'right' });
  ry += 10;

  // Amount in words
  const wordsLabel = isProforma ? 'AMOUNT IN WORDS:' : isTaxInvoice ? 'TAX INVOICE TOTAL IN WORDS:' : 'INVOICE TOTAL IN WORDS:';
  sf(pdf, 239, 246, 255);
  pdf.rect(rightX, ry, rightW, 10, 'F');
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 17, 24, 39);
  pdf.text(wordsLabel, rightX + 2, ry + 3.5);
  pdf.setFont('helvetica', 'normal');
  const wl: string[] = pdf.splitTextToSize(numToWords(inv.totalAmount || 0), rightW - 4);
  let wy = ry + 7;
  for (const l of wl) { pdf.text(l, rightX + 2, wy); wy += 3.5; }
  ry = Math.max(ry + 10, wy + 1);

  // Advance / Balance Due
  const totalPaid = Number(inv.totalPaid) || 0;
  const balanceDue = Number(inv.remainingBalance) || (Number(inv.totalAmount) - totalPaid);

  sd(pdf, 229, 231, 235);
  pdf.setLineWidth(0.2);
  pdf.line(rightX, ry + 7, rightX + rightW, ry + 7);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  st(pdf, 107, 114, 128);
  pdf.text('Advance / Total Paid', rightX + 2, ry + 5);
  pdf.text(':', rightX + rightW / 2, ry + 5, { align: 'center' });
  st(pdf, 22, 163, 74);
  pdf.setFont('helvetica', 'bold');
  pdf.text(fmtINR(totalPaid), rightX + rightW - 2, ry + 5, { align: 'right' });
  ry += 7;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 107, 114, 128);
  pdf.text('Balance Due', rightX + 2, ry + 5);
  pdf.text(':', rightX + rightW / 2, ry + 5, { align: 'center' });
  st(pdf, 220, 38, 38);
  pdf.text(fmtINR(balanceDue), rightX + rightW - 2, ry + 5, { align: 'right' });
  ry += 8;

  const summaryBottom = Math.max(ly, ry) + 4;

  // Footer bar — add new page if it would overflow
  let footerY = summaryBottom + 2;
  if (footerY + 14 > PH - 5) {
    pdf.addPage();
    footerY = MT;
  }
  sf(pdf, ...primary);
  pdf.rect(ML, footerY, CW, 11, 'F');
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 255, 255, 255);
  pdf.text(`Thank you for your business — ${company.companyName || ''}`, PW / 2, footerY + 5, { align: 'center' });
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('This is a computer generated document. No signature is required.', PW / 2, footerY + 9.5, { align: 'center' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export function
// ─────────────────────────────────────────────────────────────────────────────
export async function generateInvoicePdf(
  inv: any,
  company: any,
  qrDataUrl: string,
  filename: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');

  const primary  = hexToRgb(company.pdfAccentColor || '#1e3a8a');
  const lightBgR = hexToRgb(company.pdfAccentColor || '#1e3a8a');
  const lightBg: [number, number, number] = [
    Math.round(lightBgR[0] * 0.05 + 255 * 0.95),
    Math.round(lightBgR[1] * 0.05 + 255 * 0.95),
    Math.round(lightBgR[2] * 0.05 + 255 * 0.95),
  ];

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const logoImg  = await loadImg(company.logo || '');
  const qrImg    = qrDataUrl ? await loadImg(qrDataUrl) : null;

  const isProforma   = inv.documentType === 'PROFORMA_INVOICE';
  const isTaxInvoice = inv.documentType === 'TAX_INVOICE';
  const showHsn      = isProforma || isTaxInvoice;
  const showImg      = isProforma; // product images shown on proforma invoice only
  const isInterState = inv.gstType === 'IGST';

  // Computed totals (same logic as InvoicePrintView)
  const items = inv.items || [];

  // Pre-load product images for proforma invoices only (product items only)
  const productItems = items.filter((it: any) => (it.itemType || 'PRODUCT') !== 'SERVICE');
  const itemImgs: (typeof logoImg)[] = showImg
    ? await Promise.all(productItems.map((it: any) =>
        loadImg(it.imagePath || '')
      ))
    : productItems.map(() => null);
  // Computed totals — use discountAmount when available to avoid % rounding errors
  const computedSubtotal = productItems
    .reduce((s: number, it: any) =>
      s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
  const backendDiscount = Number(inv.totalDiscount) || 0;
  const computedDiscount = backendDiscount > 0 ? backendDiscount
    : productItems.reduce((s: number, it: any) => {
        const base    = (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1);
        const discAmt = Number(it.discountAmount) > 0
          ? Number(it.discountAmount)
          : base * (Number(it.discountPercentage) || 0) / 100;
        return s + discAmt;
      }, 0);
  const computedTaxableAmount = computedSubtotal - computedDiscount;
  const totalTax = Number(inv.totalTax) || 0;

  // Draw header (page 1 only)
  let y = await drawInvoiceHeader(pdf, inv, company, logoImg, primary);

  // Items table
  y = drawTableHeader(pdf, y, primary, showHsn, showImg);
  let tableTopY = y - TH_H; // top of table border

  for (let i = 0; i < productItems.length; i++) {
    const it = productItems[i];

    const unitPrice = Number(it.unitPrice) || 0;
    const qty       = Number(it.quantity)  || 1;
    const taxPct    = Number(it.taxPercentage) || 0;
    const base      = unitPrice * qty;
    // Use stored discountAmount first (exact), fall back to % calculation
    const discAmt   = Number(it.discountAmount) > 0
      ? Number(it.discountAmount)
      : base * (Number(it.discountPercentage) || 0) / 100;
    const taxableV  = base - discAmt;
    const gstAmt    = Number(it.taxAmount) || (taxableV * taxPct / 100);
    const total     = Number(it.total ?? it.itemTotal) || (taxableV + gstAmt);
    const name      = it.productName || '—';
    const desc      = it.productDescription || '';

    // Estimate row height
    const effDet = I_DET_BASE - (showImg ? I_IMG : 0) - (showHsn ? I_HSN : 0);
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    const nLines = (pdf.splitTextToSize(name, effDet - PAD*2) as string[]).length;
    const dLines = desc ? (pdf.splitTextToSize(desc, effDet - PAD*2) as string[]).length : 0;
    const imgMinH = showImg ? IMG_SIZE + PAD * 2 : 0;
    const rowH = Math.max(PAD + nLines * 4.2 + (dLines ? 1.5 + dLines * 3.8 : 0) + PAD, imgMinH, 10);

    // Page break if needed
    if (y + rowH > PH - MB) {
      drawTableOuterBorders(pdf, tableTopY, y);
      pdf.addPage();
      y = MT;
      tableTopY = y;
      y = drawTableHeader(pdf, y, primary, showHsn, showImg);
    }

    const rh = drawItemRow(
      pdf, y, i + 1, name, desc, it.hsnCode || '',
      qty, unitPrice, discAmt, taxableV, taxPct, total,
      showHsn, showImg, itemImgs[i],
      primary, lightBg, i % 2 === 0,
    );
    y += rh;
  }

  drawTableOuterBorders(pdf, tableTopY, y);
  y += 4;

  // ── Service / installation charge rows ──────────────────────────────────
  // Services are shown as individual named rows in the totals summary (right side),
  // same pattern as the quotation PDF. No separate section block needed here.

  const summaryH = 160; // conservative estimate — covers bank details + totals + footer
  if (y + summaryH > PH - MB) {
    pdf.addPage();
    y = MT;
  }

  drawInvoiceSummary(
    pdf, y, inv, company, primary, lightBg,
    computedSubtotal, computedDiscount, computedTaxableAmount,
    totalTax, isProforma, isTaxInvoice, isInterState, qrImg,
  );

  pdf.save(filename);
}
