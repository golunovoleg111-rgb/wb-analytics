import * as Calc from './calculations.js';
import * as Store from './store.js';
import {IMPORT_TEMPLATES,validateHeader} from './importTemplates.js';
import * as Warehouse from '../domain/warehouse.js';
import * as FBS from '../domain/fbs.js';
import * as Production from '../domain/production.js';
export const VERSION='2.3.0';
export const BJOB={version:VERSION,modules:['products','sales','stocks','advertising','unit','warehouses','shipments','fbs','production','analytics','reports','api','settings']};
export {Calc,Store,IMPORT_TEMPLATES,validateHeader,Warehouse,FBS,Production};
export function snapshot(){return Store.load();}
export function health(){const d=Store.load();return {version:VERSION,ready:true,entities:Object.fromEntries(Object.entries(d).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]))};}
