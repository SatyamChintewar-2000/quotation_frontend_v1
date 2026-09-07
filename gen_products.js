const XLSX = require('./node_modules/xlsx');

const columns = [
  'Code','HSN/SAC Code','Product Name *','Brand','Category','Unit',
  'MRP (₹) *','Purchase Price (₹)','Tax Type (GST/IGST/No Tax)','GST (%)',
  'Quantity *','Discount (%)','Net Weight (kg)','Stack Weight (kg)','CBM',
  'Expiry Date (dd-mm-yyyy)','Description','Currency (INR/USD)','Purchase Price (USD)'
];

// Code, HSN, Name, Brand, Category, Unit, MRP, PurchaseINR, TaxType, GST%,
// Qty, Disc%, NetWt, StackWt, CBM, Expiry, Desc, Currency, USDPrice
const products = [
  ['YTT9','','Commercial Treadmil(LED SCREEN)','','Cardio','piece',108300,0,'GST',18,10,0,'','','2','','','USD',630],
  ['ZF9200','','Elliptical','','Cardio','piece',70110,0,'GST',18,10,0,'','','2.2','','','USD',369],
  ['ZF7500','','Spinning Bike','','Cardio','piece',23750,0,'GST',18,10,0,50,'','0.35','','','USD',125],
  ['ZF6100','','Air Rower','','Cardio','piece',27550,0,'GST',18,10,0,30,'','0.5','','','USD',145],
  ['ZF6400','','Air bike','','Cardio','piece',37620,0,'GST',18,10,0,49,'','0.35','','','USD',198],
  ['ZF6200','','SKI MACHINE','','Cardio','piece',30210,0,'GST',18,10,0,50,'','0.5','','','USD',159],
  ['YTSL50','','STAIR CLIMBER','','Cardio','piece',91200,0,'GST',18,10,0,440,'','1.6','','','USD',480],
  ['HS33','','HIGH-LOW PULL TRAINER','','Strength','piece',89300,0,'GST',18,10,0,'',100,'0.9','','','USD',470],
  ['HS23','','Low Row','','Strength','piece',85500,0,'GST',18,10,0,'',100,'0.7','','','USD',450],
  ['HS31','','LEG CURL/EXTENSION','','Strength','piece',91200,0,'GST',18,10,0,'',100,'0.65','','','USD',480],
  ['HS32','','ABDUCTOR/ADDUCTOR','','Strength','piece',89300,0,'GST',18,10,0,'',100,'0.7','','','USD',470],
  ['HS02','','PEARL DELT/PEC FLY','','Strength','piece',85500,0,'GST',18,10,0,'',100,'0.7','','','USD',450],
  ['HS09','','BICEPS CURL','','Strength','piece',85500,0,'GST',18,10,0,'',100,'0.4','','','USD',450],
  ['HS15','','PRONE LEG CURL','','Strength','piece',85500,0,'GST',18,10,0,'',100,'0.5','','','USD',450],
  ['TB56','','45 degree Leg Press','','Strength','piece',104500,0,'GST',18,10,0,224,'','1.089','','','USD',550],
  ['TB65','','Super Squat','','Strength','piece',87400,0,'GST',18,10,0,196,'','1.5391','','','USD',460],
  ['TM72','','Abdominal','','Strength','piece',62700,0,'GST',18,10,0,175,'','1.055','','','USD',330],
  ['TM118','','HIP GLUTE','','Strength','piece',62700,0,'GST',18,10,0,'','','0.69','','','USD',330],
  ['TB69','','Forearm machine','','Strength','piece',45600,0,'GST',18,10,0,110,65,'0.385','','','USD',240],
  ['TB62','','Seated Calf','','Strength','piece',30400,0,'GST',18,10,0,53,'','0.3595','','','USD',160],
  ['TB41','','Olympic Decline Bench','','Benches','piece',38000,0,'GST',18,10,0,78,'','0.5264','','','USD',200],
  ['TB42','','Olympic Bench Incline','','Benches','piece',38000,0,'GST',18,10,0,77,'','0.7106','','','USD',200],
  ['TB43','','Olympic Bench','','Benches','piece',36100,0,'GST',18,10,0,61,'','0.3443','','','USD',190],
  ['TB38','','Multi-Purpose Bench','','Benches','piece',14250,0,'GST',18,10,0,23,'','0.1179','','','USD',75],
  ['TB39','','Super Bench','','Benches','piece',28500,0,'GST',18,10,0,38,'','0.2905','','','USD',150],
  ['TB36','','Flat Bench','','Benches','piece',13300,0,'GST',18,10,0,36,'','0.1449','','','USD',70],
  ['TB54','','Vertical Plate Tree','','Accessories','piece',14250,0,'GST',18,10,0,25,'','0.1176','','','USD',75],
  ['TB55','','Barbell Rack','','Accessories','piece',30400,0,'GST',18,10,0,69,'','0.4725','','','USD',160],
  ['TB45','','Back Extension','','Accessories','piece',27550,0,'GST',18,10,0,45,'','0.4868','','','USD',145],
  ['TB49','','Dumbbell Rack','','Accessories','piece',36100,0,'GST',18,10,0,66,'','0.1144','','','USD',190],
  ['AD-042','','Bar Holder','','Accessories','piece',15000,0,'GST',18,10,0,'','','','','','USD',100],
  ['IND','','DEADLIFT PLATFOAM','','Accessories','piece',45000,0,'GST',18,10,0,'','','1','','','USD',237],
  ['TB63','','Smith Machine','','Strength','piece',100700,0,'GST',18,10,0,284,'','1.1813','','','USD',530],
  ['TB16','','Adjustable Crossover','','Strength','piece',129200,0,'GST',18,10,0,312,160,'2.4297','','','USD',680],
  ['TB17','','Functional Trainer','','Strength','piece',129200,0,'GST',18,10,0,342,160,'1.1374','','','USD',680],
  ['HF06','','STANDING MULTI FLY','','Strength','piece',117800,0,'GST',18,10,0,'',100,'1.3','','','USD',620],
  ['TM26','','Seated chest press','','Strength','piece',62700,0,'GST',18,10,0,196,'','1.0017','','','USD',330],
  ['TN119','','STAND PULL BACK','','Strength','piece',88540,0,'GST',18,10,0,144,'','1','','','USD',466],
  ['TM21','','shoulder press','','Strength','piece',62700,0,'GST',18,10,0,189,'','0.8476','','','USD',330],
  ['TM06','','Incline Row','','Strength','piece',62700,0,'GST',18,10,0,165,'','0.9523','','','USD',330],
];

const rows = products.map(p => {
  const obj = {};
  columns.forEach((col, i) => { obj[col] = p[i]; });
  return obj;
});

const ws = XLSX.utils.json_to_sheet(rows, { header: columns });

// Column widths
const colWidths = [10,12,30,12,14,8,12,16,24,8,10,10,14,14,10,22,20,16,20];
ws['!cols'] = colWidths.map(w => ({ wch: w }));

// Freeze top row
ws['!freeze'] = { xSplit: 0, ySplit: 1 };

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Products');

const outPath = '../products_import.xlsx';
XLSX.writeFile(wb, outPath);
console.log('Created: products_import.xlsx with', products.length, 'products');
