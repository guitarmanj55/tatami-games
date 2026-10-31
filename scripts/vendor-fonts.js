// usage: node vendor-fonts.js <webRoot> <cssUrl> [extraTextDir]
const fs=require('fs'),path=require('path');
const [web,cssUrl]=process.argv.slice(2);
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
function walk(d,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.git','.wrangler','vendor','fonts','audio'].includes(f.name))continue;const p=path.join(d,f.name);f.isDirectory()?walk(p,o):/\.(html|js|css|json|md)$/.test(f.name)&&o.push(p)}return o}
const used=new Set();for(const f of walk(web))for(const ch of fs.readFileSync(f,'utf8'))used.add(ch.codePointAt(0));
for(let c=32;c<127;c++)used.add(c);
(async()=>{
  const css=await (await fetch(cssUrl,{headers:{'User-Agent':UA}})).text();
  const blocks=[...css.matchAll(/(?:\/\*\s*([^*]+?)\s*\*\/\s*)?(@font-face\s*\{[^}]+\})/g)].map(([a,s,f])=>[a,s||'slice',f]);
  const outDir=path.join(web,'fonts');fs.mkdirSync(outDir,{recursive:true});
  let out='/* Vendored from Google Fonts so the app works offline. Only the subsets this app\'s text uses. */\n';const got={};let kept=0,bytes=0;
  for(const [,sub,face] of blocks){
    const range=(face.match(/unicode-range:\s*([^;]+);/)||[])[1]||'';
    const hit=range.split(',').some(r=>{const m=r.trim().replace('U+','').split('-');const a=parseInt(m[0].replace(/\?/g,'0'),16),b=m[1]?parseInt(m[1],16):parseInt(m[0].replace(/\?/g,'F'),16);for(const c of used)if(c>=a&&c<=b)return true;return false});
    if(!hit)continue;
    const fam=face.match(/font-family:\s*'([^']+)'/)[1].replace(/\s+/g,'');const url=face.match(/url\(([^)]+)\)/)[1];
    if(!got[url]){const name=`${fam}-${Object.keys(got).length}.woff2`;const buf=Buffer.from(await (await fetch(url)).arrayBuffer());fs.writeFileSync(path.join(outDir,name),buf);got[url]=name;bytes+=buf.length}
    out+=`/* ${sub} */\n`+face.replace(url,got[url])+'\n';kept++;
  }
  fs.writeFileSync(path.join(outDir,'fonts.css'),out);
  console.log(`${web}: ${kept}/${blocks.length} faces, ${Object.keys(got).length} files, ${(bytes/1024).toFixed(0)} KB`);
  console.log('FILES '+['fonts.css',...Object.values(got)].join(' '));
})();
