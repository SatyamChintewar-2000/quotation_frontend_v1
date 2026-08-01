/**
 * Enterprise-grade PDF generator — v3
 *
 * Fixes from v2:
 *  - lightBg colour calculation was producing black/invalid colours → fixed
 *  - Product name was duplicated (image column + details column) → removed from image col
 *  - Alternate row colours removed — all rows white
 *  - Row packing: rows render on current page when they fit
 *  - Summary section starts immediately after last product row when space permits
 *  - Compact, professional header (no excessive padding)
 *  - Complete borders on every page (T/L/R/B)
 *  - Table header repeated on every new page
 *  - No hardcoded spacing before summary
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface PdfItem {
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
  imagePathSnapshot?: string;
  image?: string;
  description?: string;
  productDescription?: string;
  productDescriptionSnapshot?: string;
}

export interface PdfService {
  serviceName: string;
  servicePrice: number;
  serviceTax: number;
}

export interface PdfQuotation {
  id: string | number;
  quotationNumber?: string;
  clientName?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  createdAt: string;
  quotationDate?: string;
  deliveryDate?: string;
  notes?: string;
  termsAndConditions?: string;
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  grandTotal: number;
  items: PdfItem[];
  services?: PdfService[];
  hideServiceChargesOnPdf?: boolean;
}

export interface PdfCompany {
  companyName?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  logo?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  upiId?: string;
  termsAndConditions?: string;
  pdfThemeName?: string;
  pdfAccentColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Constants (all in mm)
// ─────────────────────────────────────────────────────────────────────────────
const PW   = 210;          // A4 width
const PH   = 297;          // A4 height
const ML   = 10;           // left margin
const MR   = 10;           // right margin
const MT   = 10;           // top margin (first page after header; subsequent pages)
const MB   = 15;           // bottom safe area — never draw below PH-MB
const CW   = PW - ML - MR; // 190 mm

// Table columns — must sum to CW (190)
const C_SR   =  9;
const C_IMG  = 28;
const C_DET  = 79;   // product details (name + desc)
const C_MRP  = 22;
const C_BEST = 22;
const C_QTY  = 12;
const C_AMT  = 18;
// sum: 9+28+79+22+22+12+18 = 190 ✓

const TH_H     =  8;    // table header height
const IMG_SIZE = 22;    // image cell image size (mm)
const PAD      =  2;    // cell inner padding
const LINE_BODY = 4.2;  // body text line height
const LINE_DESC = 3.8;  // description line height

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#1e3a8a').replace('#', '');
  const full  = clean.length === 3
    ? clean.split('').map(c => c+c).join('')
    : clean.padEnd(6, '0');
  const n = parseInt(full, 16);
  if (isNaN(n)) return [30, 58, 138];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Make a very light tint of a primary colour (for backgrounds). */
function makeLightBg(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  // blend 92% white + 8% primary
  return [
    Math.round(r * 0.08 + 255 * 0.92),
    Math.round(g * 0.08 + 255 * 0.92),
    Math.round(b * 0.08 + 255 * 0.92),
  ];
}

function sf(pdf: any, r: number, g: number, b: number) { pdf.setFillColor(r, g, b); }
function sd(pdf: any, r: number, g: number, b: number) { pdf.setDrawColor(r, g, b); }
function st(pdf: any, r: number, g: number, b: number) { pdf.setTextColor(r, g, b); }

// ─────────────────────────────────────────────────────────────────────────────
// Text / number helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d
    : dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtINR(n: number) {
  return 'Rs. ' + new Intl.NumberFormat('en-IN').format(Math.round(n));
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
// Image loader
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
// Row height calculation
// ─────────────────────────────────────────────────────────────────────────────
function calcRowHeight(
  pdf: any,
  name: string,
  desc: string,
  companyName: string,
  hasImage: boolean,
): number {
  const detW = C_DET - PAD * 2;

  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');

  // Company name line
  const cLines = (pdf.splitTextToSize(companyName || '', detW) as string[]).length;
  // Product name lines
  const nLines = (pdf.splitTextToSize(name || '—', detW) as string[]).length;
  // Description lines
  const dLines = desc ? (pdf.splitTextToSize(desc, detW) as string[]).length : 0;

  // Text height
  const textH = PAD
    + cLines * LINE_BODY
    + 1
    + nLines * LINE_BODY
    + (dLines ? 1.5 + dLines * LINE_DESC : 0)
    + PAD;

  // Image height — only if image present
  const imgH = hasImage ? IMG_SIZE + PAD * 2 : 0;

  // Min height: if no image and short text → compact row (8mm)
  const minH = hasImage ? 14 : 8;
  return Math.max(textH, imgH, minH);
}

// ─────────────────────────────────────────────────────────────────────────────
// Table header
// ─────────────────────────────────────────────────────────────────────────────
function drawTableHeader(pdf: any, y: number, primary: [number,number,number]): number {
  sf(pdf, ...primary);
  pdf.rect(ML, y, CW, TH_H, 'F');

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 255, 255, 255);

  const cols = [
    { lbl:'Sr.',            x: ML,                                       w: C_SR,   al:'center' },
    { lbl:'Image',          x: ML+C_SR,                                  w: C_IMG,  al:'center' },
    { lbl:'Product Details',x: ML+C_SR+C_IMG,                            w: C_DET,  al:'left'   },
    { lbl:'M.R.P',          x: ML+C_SR+C_IMG+C_DET,                      w: C_MRP,  al:'right'  },
    { lbl:'Best Price',     x: ML+C_SR+C_IMG+C_DET+C_MRP,               w: C_BEST, al:'right'  },
    { lbl:'Qty',            x: ML+C_SR+C_IMG+C_DET+C_MRP+C_BEST,        w: C_QTY,  al:'center' },
    { lbl:'Amount',         x: ML+C_SR+C_IMG+C_DET+C_MRP+C_BEST+C_QTY, w: C_AMT,  al:'right'  },
  ] as const;

  for (const c of cols) {
    const tx = c.al === 'right'  ? c.x + c.w - PAD
             : c.al === 'center' ? c.x + c.w / 2
             : c.x + PAD;
    pdf.text(c.lbl, tx, y + TH_H - 2, { align: c.al });
  }
  return y + TH_H;
}

// ─────────────────────────────────────────────────────────────────────────────
// Table outer borders (L, R, B lines — drawn after each section)
// ─────────────────────────────────────────────────────────────────────────────
function drawTableOuterBorders(pdf: any, topY: number, bottomY: number) {
  sd(pdf, 150, 150, 150);
  pdf.setLineWidth(0.4);
  pdf.line(ML,      topY,    ML,      bottomY); // left
  pdf.line(ML+CW,   topY,    ML+CW,   bottomY); // right
  pdf.line(ML,      bottomY, ML+CW,   bottomY); // bottom
  // top is drawn separately (either header or continuation line)
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw a single product row
// ─────────────────────────────────────────────────────────────────────────────
function drawProductRow(
  pdf: any,
  y: number,
  rowH: number,
  srNo: number,
  name: string,
  desc: string,
  companyName: string,
  img: { data: string; fmt: 'JPEG'|'PNG' } | null,
  price: number,
  bestPrice: number,
  qty: number,
  total: number,
  primary: [number,number,number],
) {
  // White background for ALL rows
  sf(pdf, 255, 255, 255);
  pdf.rect(ML, y, CW, rowH, 'F');

  // Horizontal row separator — solid visible line
  sd(pdf, 190, 190, 190);
  pdf.setLineWidth(0.3);
  pdf.line(ML, y + rowH, ML + CW, y + rowH);

  // Vertical column dividers — slightly lighter than row separator
  sd(pdf, 210, 210, 210);
  pdf.setLineWidth(0.2);
  let vx = ML + C_SR;
  for (const w of [C_IMG, C_DET, C_MRP, C_BEST, C_QTY]) {
    pdf.line(vx, y, vx, y + rowH);
    vx += w;
  }
  pdf.line(vx, y, vx, y + rowH);

  const midY = y + rowH / 2 + 1;

  // Sr No
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 55, 65, 81);
  pdf.text(String(srNo), ML + C_SR / 2, midY, { align: 'center' });

  // Image — centred in image cell, NO product name below it
  const imgX = ML + C_SR + (C_IMG - IMG_SIZE) / 2;
  const imgY = y + (rowH - IMG_SIZE) / 2;
  if (img) {
    try { pdf.addImage(img.data, img.fmt, imgX, imgY, IMG_SIZE, IMG_SIZE); }
    catch { drawImgPlaceholder(pdf, imgX, y, rowH); }
  } else {
    drawImgPlaceholder(pdf, imgX, y, rowH);
  }

  // Product Details column: Company Name + Product Name + Description
  const detX = ML + C_SR + C_IMG + PAD;
  const detW = C_DET - PAD * 2;
  let ty = y + PAD + 3;

  // Company Name (bold, primary colour)
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, ...primary);
  const cLines: string[] = pdf.splitTextToSize(companyName || '', detW);
  for (const l of cLines) { pdf.text(l, detX, ty); ty += LINE_BODY; }

  // Gap between company and product name
  ty += 1;

  // Product Name (bold, dark)
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 17, 24, 39);
  const nLines: string[] = pdf.splitTextToSize(name || '—', detW);
  for (const l of nLines) { pdf.text(l, detX, ty); ty += LINE_BODY; }

  // Description (normal, grey)
  if (desc) {
    ty += 1.5;
    pdf.setFontSize(6.8);
    pdf.setFont('helvetica', 'normal');
    st(pdf, 75, 85, 99);
    const dLines: string[] = pdf.splitTextToSize(desc, detW);
    for (const l of dLines) { pdf.text(l, detX, ty); ty += LINE_DESC; }
  }

  // MRP
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  st(pdf, 107, 114, 128);
  pdf.text(new Intl.NumberFormat('en-IN').format(price),
    ML + C_SR + C_IMG + C_DET + C_MRP - PAD, midY, { align: 'right' });

  // Best Price
  pdf.setFont('helvetica', 'bold');
  st(pdf, 17, 24, 39);
  pdf.text(new Intl.NumberFormat('en-IN').format(bestPrice),
    ML + C_SR + C_IMG + C_DET + C_MRP + C_BEST - PAD, midY, { align: 'right' });

  // Qty
  pdf.setFont('helvetica', 'bold');
  st(pdf, 17, 24, 39);
  pdf.text(String(qty),
    ML + C_SR + C_IMG + C_DET + C_MRP + C_BEST + C_QTY / 2, midY, { align: 'center' });

  // Amount
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, ...primary);
  pdf.text(new Intl.NumberFormat('en-IN').format(Math.round(total)),
    ML + CW - PAD, midY, { align: 'right' });
}

function drawImgPlaceholder(pdf: any, x: number, y: number, rowH: number) {
  // Small compact placeholder centred in the cell — not full IMG_SIZE
  const boxW = 18, boxH = 12;
  const bx = x + (IMG_SIZE - boxW) / 2;
  const by = y + (rowH - boxH) / 2;
  sd(pdf, 220, 220, 220);
  sf(pdf, 250, 250, 250);
  pdf.setLineWidth(0.15);
  pdf.rect(bx, by, boxW, boxH, 'FD');
  // Faint "No Image" text
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'normal');
  st(pdf, 200, 200, 200);
  pdf.text('No Image', bx + boxW / 2, by + boxH / 2 + 1, { align: 'center' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page 1 compact header
// ─────────────────────────────────────────────────────────────────────────────
async function drawCompactHeader(
  pdf: any,
  q: PdfQuotation,
  company: PdfCompany,
  logoImg: { data: string; fmt: 'JPEG'|'PNG' } | null,
  primary: [number,number,number],
): Promise<number> {
  let y = MT;

  // ── Logo (left) + Company info (right) ──────────────────────────────────
  const LOGO_W = 30, LOGO_H = 20;
  if (logoImg) {
    try { pdf.addImage(logoImg.data, logoImg.fmt, ML, y, LOGO_W, LOGO_H); }
    catch { /* skip */ }
  }

  // Company name
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  st(pdf, ...primary);
  pdf.text((company.companyName || '').toUpperCase(), PW - MR, y + 5, { align: 'right' });

  // Address + contact on right
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  st(pdf, 55, 65, 81);
  let ry = y + 10;
  if (company.address) {
    const al: string[] = pdf.splitTextToSize(company.address, 100);
    for (const l of al.slice(0, 2)) { pdf.text(l, PW - MR, ry, { align: 'right' }); ry += 3.5; }
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

  // Primary line under header
  sf(pdf, ...primary);
  pdf.rect(ML, y, CW, 1, 'F');
  y += 4;

  // ── Bill To | QUOTATION title | Quote details — bordered 3-column box ──
  const C1 = 60, C2 = 62, C3 = CW - C1 - C2;
  const secY = y;
  const secH = 28; // fixed height for the info row

  // Outer border of the 3-column section
  sd(pdf, ...primary);
  pdf.setLineWidth(0.5);
  pdf.rect(ML, secY, CW, secH, 'S');

  // Vertical dividers between columns
  pdf.setLineWidth(0.4);
  pdf.line(ML + C1, secY, ML + C1, secY + secH);          // divider 1
  pdf.line(ML + C1 + C2, secY, ML + C1 + C2, secY + secH); // divider 2

  // ── Bill To (left column) ──
  const pad = 4;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 107, 114, 128);
  pdf.text('BILL TO:', ML + pad, secY + 5);
  pdf.setFontSize(10);
  st(pdf, 17, 24, 39);
  pdf.text(q.clientName || q.customerName || '-', ML + pad, secY + 12);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  let by = secY + 17;
  if (q.customerPhone) {
    pdf.text(`Ph: ${q.customerPhone}`, ML + pad, by);
    by += 4;
  }
  if (q.customerAddress) {
    const al: string[] = pdf.splitTextToSize(q.customerAddress, C1 - pad * 2);
    for (const l of al.slice(0, 2)) { pdf.text(l, ML + pad, by); by += 3.5; }
  }

  // ── QUOTATION title (centre column) ──
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  st(pdf, ...primary);
  const cx = ML + C1 + C2 / 2;
  pdf.text('QUOTATION', cx, secY + secH / 2 + 3, { align: 'center' });
  // Underline
  sf(pdf, ...primary);
  pdf.rect(cx - 20, secY + secH / 2 + 5, 40, 0.8, 'F');

  // ── Quote details (right column) ──
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  const dx = ML + C1 + C2 + pad;
  const rw = C3 - pad * 2;

  st(pdf, 107, 114, 128);
  pdf.text('Quote No:', dx, secY + 8);
  st(pdf, ...primary);
  pdf.text(q.quotationNumber || `Q-${q.id}`, dx + rw, secY + 8, { align: 'right' });

  st(pdf, 107, 114, 128);
  pdf.text('Quote Date:', dx, secY + 15);
  st(pdf, 17, 24, 39);
  pdf.text(fmtDate(q.quotationDate || q.createdAt), dx + rw, secY + 15, { align: 'right' });

  if (q.deliveryDate) {
    st(pdf, 107, 114, 128);
    pdf.text('Delivery:', dx, secY + 22);
    st(pdf, 17, 24, 39);
    pdf.text(fmtDate(q.deliveryDate), dx + rw, secY + 22, { align: 'right' });
  }

  y = secY + secH + 6;

  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimate summary height so we know whether it fits on the current page
// ─────────────────────────────────────────────────────────────────────────────
function estimateSummaryHeight(
  pdf: any,
  q: PdfQuotation,
  company: PdfCompany,
  hasQr: boolean,
): number {
  const leftW = 78;
  let lh = 4; // top gap

  // Bank block
  if (company.bankName || company.accountNumber) {
    const bankRows = [company.bankName, company.accountNumber, company.ifscCode, company.branchName, company.upiId].filter(Boolean);
    lh += 6.5 + bankRows.length * 4.5 + 4;
  }

  // Terms
  const terms = q.termsAndConditions || company.termsAndConditions;
  if (terms) {
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    const tl = (pdf.splitTextToSize(terms, leftW - 2) as string[]).length;
    lh += 9 + tl * 3.5 + 3;
  }

  // QR
  if (hasQr) lh += 27;

  // Right side: totals
  const serviceCount = (q.services||[]).filter(s=>Number(s.servicePrice)>0).length;
  const totRowCount  = 4 + (!q.hideServiceChargesOnPdf ? serviceCount : 0);
  const rh = 4                    // top gap
    + totRowCount * 7             // totals rows
    + 10                          // final total bar
    + 10                          // words block
    + 2;

  // Footer bar
  const footerH = 13;

  return Math.max(lh, rh) + footerH + 6;
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary + Footer (drawn at the bottom of the last product page or new page)
// ─────────────────────────────────────────────────────────────────────────────
function drawSummaryAndFooter(
  pdf: any,
  startY: number,
  q: PdfQuotation,
  company: PdfCompany,
  qrImg: { data: string; fmt: 'PNG'|'JPEG' } | null,
  primary: [number,number,number],
) {
  const leftW = 78;
  const rightX = ML + leftW + 4;
  const rightW = CW - leftW - 4;

  const serviceTotal = (q.services || []).reduce((a, sv) => {
    const p = Number(sv.servicePrice)||0, t = Number(sv.serviceTax)||0;
    return a + p + p*t/100;
  }, 0);
  const grandTotal = q.subtotal - q.totalDiscount + q.totalGst + serviceTotal;
  const hideServices = q.hideServiceChargesOnPdf;

  // ── TOP SEPARATOR ────────────────────────────────────────────────────────
  sd(pdf, 209, 213, 219);
  pdf.setLineWidth(0.3);
  pdf.line(ML, startY, ML + CW, startY);
  let y = startY + 4;

  let ly = y, ry = y;

  // ── LEFT: Bank details ──────────────────────────────────────────────────
  if (company.bankName || company.accountNumber) {
    sf(pdf, ...primary);
    pdf.rect(ML, ly, leftW, 6.5, 'F');
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'bold');
    st(pdf, 255, 255, 255);
    pdf.text('BANK ACCOUNT DETAILS', ML + 2, ly + 4.5);
    ly += 6.5;

    const bankRows = [
      ['Bank Name',   company.bankName],
      ['Account No',  company.accountNumber],
      ['IFSC Code',   company.ifscCode],
      ['Branch',      company.branchName],
      ['UPI ID',      company.upiId],
    ].filter(r => r[1]) as [string,string][];

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

  // ── LEFT: Terms ─────────────────────────────────────────────────────────
  const terms = q.termsAndConditions || company.termsAndConditions;
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

  // ── LEFT: QR code ───────────────────────────────────────────────────────
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

  // ── RIGHT: Totals rows ──────────────────────────────────────────────────
  const totRows: { lbl: string; val: number; bold?: boolean }[] = [
    { lbl: 'Total',        val: q.subtotal },
    { lbl: 'Discount (-)', val: q.totalDiscount },
    { lbl: 'Sub Total',    val: q.subtotal - q.totalDiscount, bold: true },
    { lbl: 'Tax Amount',   val: q.totalGst },
  ];

  if (!hideServices) {
    for (const sv of (q.services||[]).filter(s=>Number(s.servicePrice)>0)) {
      const p = Number(sv.servicePrice), t = Number(sv.serviceTax)||0;
      totRows.push({ lbl: sv.serviceName || 'Service', val: p + p*t/100 });
    }
  }

  for (const row of totRows) {
    sd(pdf, 229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.line(rightX, ry + 7, rightX + rightW, ry + 7);
    pdf.setFontSize(row.bold ? 8 : 7.5);
    pdf.setFont('helvetica', row.bold ? 'bold' : 'normal');
    st(pdf, row.bold ? 17 : 107, row.bold ? 24 : 114, row.bold ? 39 : 128);
    pdf.text(row.lbl, rightX + 2, ry + 5);
    pdf.text(':', rightX + rightW/2, ry + 5, { align: 'center' });
    pdf.text(fmtINR(row.val), rightX + rightW - 2, ry + 5, { align: 'right' });
    ry += 7;
  }

  // Final Total bar
  sf(pdf, ...primary);
  pdf.rect(rightX, ry, rightW, 10, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 255, 255, 255);
  pdf.text('Final Total', rightX + 2, ry + 7);
  pdf.text(':', rightX + rightW/2, ry + 7, { align: 'center' });
  pdf.text(fmtINR(grandTotal), rightX + rightW - 2, ry + 7, { align: 'right' });
  ry += 10;

  // Amount in words
  sf(pdf, 239, 246, 255);
  pdf.rect(rightX, ry, rightW, 10, 'F');
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 17, 24, 39);
  pdf.text('INVOICE TOTAL IN WORDS:', rightX + 2, ry + 3.5);
  pdf.setFont('helvetica', 'normal');
  const wl: string[] = pdf.splitTextToSize(numToWords(grandTotal), rightW - 4);
  let wy = ry + 7;
  for (const l of wl) { pdf.text(l, rightX + 2, wy); wy += 3.5; }
  ry = Math.max(ry + 10, wy + 1);

  const summaryBottom = Math.max(ly, ry) + 4;

  // Thin border around the summary block (optional — gives it a clean container)
  sd(pdf, 220, 220, 220);
  pdf.setLineWidth(0.2);
  pdf.line(ML, startY, ML + CW, startY);  // already drawn above, skip duplicate
  pdf.line(ML, summaryBottom, ML + CW, summaryBottom);

  // ── FOOTER BAR — sits 2mm below the summary bottom ──────────────────────
  const footerY = summaryBottom + 2;
  sf(pdf, ...primary);
  pdf.rect(ML, footerY, CW, 11, 'F');
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 255, 255, 255);
  pdf.text('Thank you for your business!', PW/2, footerY + 5, { align: 'center' });
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  const fsub = [company.companyName, company.phone, company.email].filter(Boolean).join('  •  ');
  if (fsub) pdf.text(fsub, PW/2, footerY + 9.5, { align: 'center' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported function
// ─────────────────────────────────────────────────────────────────────────────
export async function generateQuotationPdf(
  q: PdfQuotation,
  company: PdfCompany,
  qrDataUrl: string,
  filename: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf');

  // ── Theme colours ──────────────────────────────────────────────────────
  const primary = hexToRgb(company.pdfAccentColor || '#1e3a8a');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Pre-load images ────────────────────────────────────────────────────
  const logoImg   = await loadImg(company.logo || '');
  const itemImgs  = await Promise.all(
    q.items.map(it => loadImg(it.imagePathSnapshot || it.imagePath || it.image || ''))
  );
  const qrImg     = qrDataUrl ? await loadImg(qrDataUrl) : null;
  const compName  = company.companyName || '';

  // ── Page 1 header ─────────────────────────────────────────────────────
  let y = await drawCompactHeader(pdf, q, company, logoImg, primary);

  // ── "Product Details" label ────────────────────────────────────────────
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  st(pdf, 17, 24, 39);
  pdf.text('PRODUCT DETAILS', ML, y + 3.5);
  sf(pdf, ...primary);
  pdf.rect(ML, y + 4.5, 28, 0.6, 'F');
  y += 9;

  // ── TABLE ──────────────────────────────────────────────────────────────
  // tableTopY tracks the top of the current table block on each page
  // (used to draw L/R borders that span from header to current row)
  let tableTopY = y;
  y = drawTableHeader(pdf, y, primary);

  // Pre-calculate row heights for all items
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  const rowHeights: number[] = q.items.map((item, i) => {
    const name = item.productNameSnapshot || item.productName || '—';
    const desc = item.productDescriptionSnapshot || item.productDescription || item.description || '';
    return calcRowHeight(pdf, name, desc, compName, !!itemImgs[i]);
  });

  // Render rows with proper page-break logic
  for (let i = 0; i < q.items.length; i++) {
    const item    = q.items[i];
    const rowH    = rowHeights[i];
    // Remaining printable space on current page (leave MB mm at bottom)
    const avail   = PH - MB - y;

    if (rowH > avail && avail < rowH) {
      // Row won't fit — close current table, start new page
      drawTableOuterBorders(pdf, tableTopY, y);

      pdf.addPage();
      y = MT;
      tableTopY = y;
      y = drawTableHeader(pdf, y, primary);
    }

    const name = item.productNameSnapshot || item.productName || '—';
    const desc = item.productDescriptionSnapshot || item.productDescription || item.description || '';
    const price     = Number(item.unitPrice ?? item.price ?? 0);
    const disc      = Number(item.discountPercentage ?? item.discount ?? 0);
    const tax       = Number(item.taxPercentage ?? item.gst ?? 0);
    const afterDisc = price * item.quantity * (1 - disc/100);
    const total     = afterDisc * (1 + tax/100);
    const bestPrice = price * (1 - disc/100);

    drawProductRow(
      pdf, y, rowH,
      i + 1, name, desc, compName,
      itemImgs[i], price, bestPrice, item.quantity, total,
      primary,
    );

    y += rowH;
  }

  // Close the last table block
  drawTableOuterBorders(pdf, tableTopY, y);
  y += 4;

  // ── SUMMARY SECTION ────────────────────────────────────────────────────
  // Calculate how much space the summary needs
  const summaryH = estimateSummaryHeight(pdf, q, company, !!qrImg);
  const remaining = PH - MB - y;

  // Add 15mm safety buffer — if even slightly tight, go to new page
  if (summaryH + 15 > remaining) {
    // Summary might not fit — start fresh page
    pdf.addPage();
    y = MT;
  } else {
    // Clearly fits — just add a small gap after last product row
    y += 6;
  }

  drawSummaryAndFooter(pdf, y, q, company, qrImg, primary);

  // ── Page numbers ───────────────────────────────────────────────────────
  const totalPages = (pdf as any).getNumberOfPages
    ? pdf.getNumberOfPages()
    : pdf.internal.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(6.5);
    pdf.setFont('helvetica', 'normal');
    st(pdf, 156, 163, 175);
    pdf.text(`Page ${p} of ${totalPages}`, PW - MR, PH - 4, { align: 'right' });
  }

  pdf.save(filename);
}
