import {promises as fs} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const ignored=new Set(['.git','node_modules','desktop/node_modules']);
const files=[];
async function walk(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    if(ignored.has(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())await walk(full);
    else files.push(path.relative(ROOT,full).replaceAll(path.sep,'/'));
  }
}
await walk(ROOT);
const fileSet=new Set(files);
const errors=[];
const localTarget=(from,spec)=>{
  const clean=spec.split('?')[0].split('#')[0];
  if(!clean.startsWith('.'))return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(from),clean));
};
for(const file of files.filter(f=>f.endsWith('.js'))){
  const result=spawnSync(process.execPath,['--check',path.join(ROOT,file)],{encoding:'utf8'});
  if(result.status!==0)errors.push(`${file}: JavaScript syntax error\n${result.stderr.trim()}`);
  const source=await fs.readFile(path.join(ROOT,file),'utf8');
  const re=/\b(?:import|export)\s+(?:[^'"`]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for(const m of source.matchAll(re)){
    const target=localTarget(file,m[1]);
    if(target&&!fileSet.has(target))errors.push(`${file}: missing local module ${m[1]} -> ${target}`);
  }
  const dyn=/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  for(const m of source.matchAll(dyn)){
    const target=localTarget(file,m[1]);
    if(target&&!fileSet.has(target))errors.push(`${file}: missing dynamic module ${m[1]} -> ${target}`);
  }
}
for(const file of files.filter(f=>f.endsWith('.html'))){
  const source=await fs.readFile(path.join(ROOT,file),'utf8');
  const re=/(?:src|href)=["']([^"']+)["']/g;
  for(const m of source.matchAll(re)){
    const target=localTarget(file,m[1]);
    if(target&&!fileSet.has(target))errors.push(`${file}: missing local asset ${m[1]} -> ${target}`);
  }
}
if(fileSet.has('sw.js')){
  const sw=await fs.readFile(path.join(ROOT,'sw.js'),'utf8');
  const match=sw.match(/const SHELL=\[(.*?)\];/s);
  if(match){
    for(const raw of match[1].matchAll(/["']([^"']+)["']/g)){
      const target=raw[1].split('?')[0];
      if(target.startsWith('./')&&!fileSet.has(target.slice(2)))errors.push(`sw.js: missing shell asset ${raw[1]} -> ${target}`);
    }
  }
}
if(errors.length){console.error(`Runtime validation failed: ${errors.length} problem(s)`);for(const error of errors)console.error(`\n- ${error}`);process.exit(1)}
console.log(`Runtime validation passed: ${files.length} files scanned.`);
