// B-JOB calculation kernel. Pure functions only: no UI, network or storage dependencies.
export const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
export const money=v=>Math.round(n(v)*100)/100;
export function unitEconomics({price,cost=0,commission=0,logistics=0,storage=0,advertising=0,packaging=0,other=0}={}){const revenue=n(price),expenses=cost+commission+logistics+storage+advertising+packaging+other,profit=money(revenue-expenses);return {revenue:money(revenue),expenses:money(expenses),profit,margin:revenue?money(profit/revenue*100):0,breakEven:money(expenses)};}
export function spp(price,sppPercent=0){const p=n(price),s=Math.min(100,Math.max(0,n(sppPercent)));return {percent:s,discount:money(p*s/100),customerPrice:money(p*(1-s/100))};}
export function advertising({spent=0,impressions=0,clicks=0,orders=0,revenue=0}={}){const spend=n(spent),imp=n(impressions),clk=n(clicks),ord=n(orders);return {spent:money(spend),ctr:imp?money(clk/imp*100):0,cpc:clk?money(spend/clk):0,cpo:ord?money(spend/ord):0,roas:spend?money(n(revenue)/spend):0};}
export function stockCoverage(stock,sold30){const s=n(stock),sold=n(sold30);return sold?money(s/sold*30):null;}
export function productionPlan({available=0,sold30=0,targetDays=45,safety=0}={}){const demand=n(sold30)/30*n(targetDays),need=Math.max(0,Math.ceil(demand+n(safety)-n(available)));return {targetUnits:Math.ceil(demand+n(safety)),productionNeed:need};}
export function splitDecimal(value){const x=money(value),whole=Math.trunc(x);return {whole,fraction:money(x-whole)};}
