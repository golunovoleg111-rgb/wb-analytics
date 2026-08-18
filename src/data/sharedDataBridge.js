import {createDataRepository} from './dataRepositoryV2.js';
import {isOnline} from './syncContract.js';

const apiBase=globalThis.__BJOB_API_BASE__??'';
const localCache=globalThis.__BJOB_CACHE__;
export const sharedRepository=createDataRepository({apiBase,cache:localCache});
export function sharedDataEnabled(){return Boolean(apiBase)&&isOnline()}
export function sharedDataState(){return sharedRepository.getState()}
export async function pullSharedStore(store){return sharedRepository.list(store)}
export async function pushSharedMutation(store,operation,payload){return sharedRepository.mutate(store,operation,payload)}
