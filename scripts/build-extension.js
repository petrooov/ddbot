import {mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),out=new URL('../dist/ddbot-chrome/',import.meta.url);
await rm(out,{recursive:true,force:true});await mkdir(new URL('shared/',out),{recursive:true});
for(const file of ['offscreen.html','offscreen.js','manifest.json','background.js','transport.js','program.js','app.js','index.html'])await copyFile(new URL(`extension/${file}`,root),new URL(file,out));
for(const file of ['schedule.js','seats.js','reservation.js','upgrade.js','map-snapshot.js','ticket-url.js','simulation.js'])await copyFile(new URL(`src/${file}`,root),new URL(`shared/${file}`,out));
for(const file of ['style.css','simulation.css'])await copyFile(new URL(`public/${file}`,root),new URL(file,out));
for(const file of ['simulation.html','simulation.js']){
 const content=(await readFile(new URL(`public/${file}`,root),'utf8')).replaceAll("'/shared/","'./shared/").replaceAll('href="/"','href="index.html"').replaceAll('href="/','href="./').replaceAll('src="/','src="./');
 await writeFile(new URL(file,out),content);
}
await copyFile(new URL('docs/chrome-extension.md',root),new URL('INSTALACE.md',out));
const zip=new URL('../dist/ddbot-chrome.zip',import.meta.url);await rm(zip,{force:true});
execFileSync('zip',['-qr',zip.pathname,'ddbot-chrome'],{cwd:new URL('../dist/',import.meta.url).pathname});
console.log('Připraveno: dist/ddbot-chrome/ a dist/ddbot-chrome.zip');
