import * as DB from '../db.js';
import { buildAssemblyRoadmap, takeFromBox } from './warehouseCore.js';

export const ASSEMBLY_REFRESH_MS=300000;
export async function refreshAssemblyOrders(){try{return await DB.all('orders')}catch{return[]}}
export async function getAssemblyTasks(){try{return(await DB.all('assemblyTasks')).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))}catch{return[]}}
export async function createAssemblyTask({shopId=null,orderIds=[],lines=[],createdBy='manager'}){if(!Array.isArray(orderIds)||!orderIds.length)throw new Error('Не выбраны заказы.');const task={id:`assembly-${crypto.randomUUID()}`,number:`ASM-${Date.now()}`,shopId,sourceOrderIds:orderIds,lines:lines.map(x=>({...x,pickedQty:Number(x.pickedQty||0)})),status:'NEW',createdAt:new Date().toISOString(),createdBy};await DB.put('assemblyTasks',task);await DB.put('assemblyEvents',{id:`assembly-event-${crypto.randomUUID()}`,taskId:task.id,type:'created',date:new Date().toISOString(),details:{orderIds}});return task;}
export async function prepareAssembly(taskId){return buildAssemblyRoadmap(taskId)}
export async function pickAssemblyItem({taskId,boxId,variantId,quantity=1}){return takeFromBox({boxId,variantId,quantity,assemblyTaskId:taskId,reason:'assembly'})}
