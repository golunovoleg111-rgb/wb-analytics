import * as Calc from './calculations.js';
import * as Store from './store.js';
import * as Runtime from './runtime.js';
import {IMPORT_TEMPLATES,validateHeader} from './importTemplates.js';
import * as Warehouse from '../domain/warehouse.js';
import * as FBS from '../domain/fbs.js';
import * as Production from '../domain/production.js';

export const VERSION='3.0.0-core-reset';
export const BJOB={version:VERSION,modules:['products','sales','stocks','advertising','unit','warehouses','shipments','fbs','production','analytics','reports','api','settings']};
export {Calc,Store,Runtime,IMPORT_TEMPLATES,validateHeader,Warehouse,FBS,Production};
export async function boot(){return Runtime.boot()}
export async function snapshot(){return Runtime.snapshot()}
export async function health(){return Runtime.health()}
