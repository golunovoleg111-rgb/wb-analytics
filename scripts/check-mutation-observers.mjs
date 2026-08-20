import {promises as fs} from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['.git','node_modules','desktop'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name.endsWith('.js'))files.push(p)}}
await walk(root);
const warnings=[];
for(const file of files){const source=await fs.readFile(file,'utf8');if(!source.includes('MutationObserver'))continue;const normalized=source.replace(/\s+/g,' ');if(/new MutationObserver\(\(\)\s*=>\s*[^;]*innerHTML\s*=/.test(normalized))warnings.push(`${path.relative(root,file)}: MutationObserver callback writes innerHTML directly; review for self-triggering loop.`)}
if(warnings.length){console.error('MutationObserver safety review required:');warnings.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('MutationObserver safety check passed.');
