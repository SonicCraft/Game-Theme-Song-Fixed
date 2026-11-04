#!/usr/bin/env node
// package.json is the canonical plugin version. To update all the manifests:
//   npm run version:set -- 3.0.1
// To verify: npm run version:check
import fs from 'node:fs';
const args=process.argv.slice(2), check=args.includes('--check');
const target=check ? undefined : args[0];
if(!check && !/^\d+\.\d+\.\d+$/.test(target||'')) {console.error('Expected version MAJOR.MINOR.PATCH');process.exit(2);}
const read=n=>JSON.parse(fs.readFileSync(n,'utf8'));
const write=(n,x)=>fs.writeFileSync(n,JSON.stringify(x,null,2)+'\n');
const pkg=read('package.json');
if(!check) {pkg.version=target;write('package.json',pkg);}
const version=pkg.version;
const plugin=read('plugin.json');
const man=read('.release-please-manifest.json');
const toml=fs.readFileSync('millennium.toml','utf8');
const t=toml.match(/^\s*\[plugin\][\s\S]*?(?=^\s*\[|$(?![\s\S]))/m);
if(!t || !(t[0].match(/^\s*version\s*=\s*"[^"]+"/gm)||[]).length) throw Error('Missing plugin version in millennium.toml');
const tv=t[0].match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1];
let lock=fs.existsSync('package-lock.json')?read('package-lock.json'):null;
if(check){
 const entries={'package.json':version,'plugin.json':plugin.version,'millennium.toml':tv,'.release-please-manifest.json':man['.']};
 if(lock){entries['package-lock.json']=lock.version; if(lock.packages?.[''])entries['package-lock root']=lock.packages[''].version;}
 for(const [f,v] of Object.entries(entries)) if(v!==version) throw Error(f+' has version '+v+'; expected '+version);
 console.log('All plugin versions match '+version);process.exit(0);
}
plugin.version=version;write('plugin.json',plugin);
man['.']=version;write('.release-please-manifest.json',man);
fs.writeFileSync('millennium.toml',toml.replace(t[0],t[0].replace(/^(\s*version\s*=\s*)"[^"]+"/m,'$1"'+version+'"')));
if(lock){lock.version=version;if(lock.packages?.[''])lock.packages[''].version=version;write('package-lock.json',lock);}
console.log('Set plugin version to '+version);
