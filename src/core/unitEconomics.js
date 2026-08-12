import {normalizeProduct} from './schema.js';

const n=v=>Number.isFinite(Number(v))?Number(v):0;
export function calculateUnitEconomics(input={}){const p=normalizeProduct(input);const price=n(p.price),discount=n(p.discount),salePrice=price*(1-discount/100),commission=n(p.commission),logistics=n(p.logisticsCost),storage=n(p.storageCost),ad=n(p.adCost),other=n(p.otherExpenses),cost=n(p.purchasePrice);const expenses=cost+commission+logistics+storage+ad+other;const profit=salePrice-expenses;return {price,discount,salePrice,cost,commission,logistics,storage,ad,other,totalExpenses:expenses,profit,margin:salePrice?profit/salePrice*100:0,roi:expenses?profit/expenses*100:0,breakEvenPrice:expenses,breakEvenDiscount:price?Math.max(0,(1-expenses/price)*100):0};}
export function calculateSPP({price=0,spp=0,discount=0}={}){const p=n(price);const explicit=n(spp);const d=n(discount);const rate=explicit||d;return {price:p,rate,finalPrice:p*(1-rate/100),discountAmount:p*rate/100};}
export function calculateLogistics({volume=0,tariff=0,coefficient=1,quantity=1}={}){return n(volume)*n(tariff)*n(coefficient)*Math.max(1,n(quantity));}
export function calculateBreakEven({costs=0,price=0,variableRate=0}={}){const fixed=n(costs),p=n(price),rate=n(variableRate)/100;const denominator=1-rate;return denominator>0?fixed/denominator:p?fixed/p:0;}
