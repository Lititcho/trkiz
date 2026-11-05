const KEY='tarkeez.v1',MAXS=4,MAXV=10;
let S;
try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!S||!S.subs)S={subs:[],active:null,tab:'v'};
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),uid=()=>Math.random().toString(36).slice(2,9);
let st=0;function save(){clearTimeout(st);st=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}},300)}
const cur=()=>S.subs.find(s=>s.id===S.active);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>{s=Math.max(0,Math.round(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60,p=n=>String(n).padStart(2,'0');return (h?h+':':'')+(h?p(m):m)+':'+p(x)};
const mv=(a,i,j)=>{if(i===j||j<0||j>=a.length)return;a.splice(j,0,a.splice(i,1)[0])};
/* ---- IndexedDB (files) ---- */
let dbp=null;
function db(){return dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('tarkeez',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej()}catch(e){rej(e)}}))}
async function fput(k,b){const d=await db();return new Promise((r,j)=>{const t=d.transaction('f','readwrite');t.objectStore('f').put(b,k);t.oncomplete=r;t.onerror=j})}
async function fget(k){const d=await db();return new Promise((r,j)=>{const q=d.transaction('f').objectStore('f').get(k);q.onsuccess=()=>r(q.result);q.onerror=j})}
async function fdel(k){try{const d=await db();d.transaction('f','readwrite').objectStore('f').delete(k)}catch(e){}}
/* ---- subjects ---- */
function mk(name){return{id:uid(),name,videos:[],items:[],cv:null,ci:null,tm:{total:25,rem:1500,run:false}}}
function addSub(){const n=$('#ns').value.trim();if(!n||S.subs.length>=MAXS)return;const s=mk(n);S.subs.push(s);S.active=s.id;save();render()}
function askDel(id){const s=S.subs.find(x=>x.id===id);modal(`<b>حذف «${esc(s.name)}»؟</b><p class="mut">سيتم حذف الفيديوهات والملفات والمؤقت الخاصة بهذه المادة نهائياً.</p><div class="row"><button class="btn" id="y">نعم، احذف</button><button class="btn g" id="n">إلغاء</button></div>`,()=>{s.items.forEach(i=>i.k&&fdel(i.k));S.subs=S.subs.filter(x=>x!==s);if(S.active===id)S.active=S.subs[0]?S.subs[0].id:null;save();render()})}
function modal(h,ok){const o=$('#ov');o.innerHTML=`<div class="modal"><div class="card">${h}</div></div>`;$('#n').onclick=()=>o.innerHTML='';$('#y').onclick=()=>{o.innerHTML='';ok()}}
function renderBar(){
  let h='<span>📘 المواد:</span>';
  S.subs.forEach(x=>h+=`<div class="chip ${x.id===S.active?'on':''}" data-sub="${x.id}">${esc(x.name)}<b data-del="${x.id}">✕</b></div>`);
  const f=S.subs.length>=MAXS?'disabled':'';
  h+=`<span class="sp"></span><input id="ns" placeholder="مادة جديدة..." maxlength="30" ${f}><button class="btn o" id="as" ${f}>+ إضافة</button><span class="mut">${S.subs.length} / ${MAXS}</span>`;
  $('#bar').innerHTML=h;
  $$('[data-sub]').forEach(e=>e.onclick=()=>{S.active=e.dataset.sub;save();render()});
  $$('[data-del]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();askDel(e.dataset.del)});
  if(!f){$('#as').onclick=addSub;$('#ns').onkeydown=e=>{if(e.key==='Enter')addSub()}}
}
function render(){
  renderBar();const s=cur();
  $('#empty').hidden=!!s;$('#work').hidden=!s;
  if(!s){killFrame();return}
  $('#sn').textContent=s.name;
  renderTimer();applyTab();renderVL();renderFL();mountPlayer(s);showItem(s);upd();
}
function applyTab(){
  $('#pv').hidden=S.tab!=='v';$('#pf').hidden=S.tab!=='f';
  $$('[data-tab]').forEach(e=>e.classList.toggle('on',e.dataset.tab===S.tab));
  if(S.tab==='f'&&frame)cmd(frame,'pauseVideo');
  if(S.tab==='v')$$('#fv video,#fv audio').forEach(m=>m.pause());
}
/* ---- timer (works in every tab) ---- */
function renderTimer(){
  const t=cur().tm;
  $$('[data-pre]').forEach(e=>e.classList.toggle('on',+e.dataset.pre===t.total));
  if(document.activeElement!==$('#tc'))$('#tc').value=t.total;
  $('#tgo').textContent=t.run?'إيقاف مؤقت':'ابدأ';
}
function setTotal(m){const t=cur().tm;t.total=m;t.rem=m*60;t.run=false;save();renderTimer();upd()}
setInterval(()=>{
  S.subs.forEach(s=>{const t=s.tm;if(!t.run)return;t.rem--;if(t.rem<=0){t.rem=0;t.run=false;done(s)}});
  save();upd();
},1000);
function done(s){
  if(s.id===S.active){if(frame)cmd(frame,'pauseVideo');$$('#fv video,#fv audio').forEach(m=>m.pause());renderTimer()}
  beep();
  const b=document.createElement('div');b.className='banner';
  b.innerHTML=`<div>⏰ انتهى الوقت! خذ استراحة${S.subs.length>1?' ('+esc(s.name)+')':''}<button class="btn g" style="background:#fff">حسناً</button></div>`;
  b.querySelector('button').onclick=()=>b.remove();document.body.appendChild(b);setTimeout(()=>b.remove(),30000);
}
function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)();[0,.35,.7].forEach(t=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=880;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(.3,c.currentTime+t);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+t+.3);o.start(c.currentTime+t);o.stop(c.currentTime+t+.3)})}catch(e){}}
const pct=v=>v.done?100:v.dur?Math.min(100,v.watched/v.dur*100):0;
function upd(){
  const s=cur();if(!s)return;
  $('#tt').textContent=fmt(s.tm.rem);$('#tb').style.width=(100-s.tm.rem/(s.tm.total*60)*100)+'%';
  const tot=s.videos.reduce((a,v)=>a+(v.dur||0),0),w=s.videos.reduce((a,v)=>a+(v.done&&v.dur?v.dur:Math.min(v.watched,v.dur||v.watched)),0);
  const p=tot?Math.min(100,Math.round(w/tot*100)):0;
  $('#op').textContent=p+'%';$('#ob').style.width=p+'%';
  $('#ot').textContent=`${s.videos.filter(v=>v.done).length} / ${s.videos.length} فيديوهات مكتملة · ${fmt(w)} من ${fmt(tot)}`;
  $$('[data-vi]').forEach((e,i)=>{const v=s.videos[i];if(v)e.querySelector('.bar i').style.width=pct(v)+'%'});
}
/* ---- videos ---- */
let frame=null,frameKey='',curT=0,pst=-1,rate=1,muted=false;
const curV=()=>{const s=cur();return s&&s.videos.find(x=>x.id===s.cv)};
function renderVL(){
  const s=cur();$('#vc').textContent=s.videos.length+' / '+MAXV;
  let h='';
  s.videos.forEach((v,i)=>{h+=`<div class="item ${s.cv===v.id?'on':''}" draggable="true" data-vi="${i}"><div class="th"><img src="https://i.ytimg.com/vi/${v.vid}/mqdefault.jpg" onerror="this.remove()" alt=""></div><div class="meta"><div>${esc(v.title)}</div><div class="mut">${v.dur?fmt(v.dur):'—'}</div><div class="bar" style="height:5px;margin-top:4px"><i style="width:${pct(v)}%"></i></div>${v.done?'<div class="ok">✓ مكتمل</div>':''}</div><div class="col"><button class="sm" data-up="${i}">▲</button><button class="sm" data-dn="${i}">▼</button><button class="sm" data-rm="${i}">✕</button></div></div>`});
  $('#vl').innerHTML=h;
  $$('[data-vi]').forEach(e=>{const i=+e.dataset.vi;
    e.onclick=()=>{s.cv=s.videos[i].id;save();renderVL();mountPlayer(s)};
    e.ondragstart=ev=>{ev.dataTransfer.setData('text/plain','v'+i);e.classList.add('drag')};
    e.ondragend=()=>e.classList.remove('drag');e.ondragover=ev=>ev.preventDefault();
    e.ondrop=ev=>{ev.preventDefault();const d=ev.dataTransfer.getData('text/plain');if(d[0]==='v'){mv(s.videos,+d.slice(1),i);save();renderVL()}}});
  $$('[data-up]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();mv(s.videos,+e.dataset.up,+e.dataset.up-1);save();renderVL()});
  $$('[data-dn]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();mv(s.videos,+e.dataset.dn,+e.dataset.dn+1);save();renderVL()});
  $$('[data-rm]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();const v=s.videos.splice(+e.dataset.rm,1)[0];if(s.cv===v.id)s.cv=s.videos[0]?s.videos[0].id:null;save();renderVL();mountPlayer(s);upd()});
}
function addVideo(){
  const s=cur(),m=$('#vu').value.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
  if(!m){$('#vu').style.borderColor='#d33';return}
  $('#vu').style.borderColor='';if(s.videos.length>=MAXV)return;
  const v={id:uid(),vid:m[1],title:'فيديو '+(s.videos.length+1),dur:0,watched:0,pos:0,done:false};
  s.videos.push(v);if(!s.cv)s.cv=v.id;$('#vu').value='';save();probe(v);renderVL();mountPlayer(s);upd();
}
function killFrame(){if(frame){frame.remove();frame=null}frameKey=''}
function mountPlayer(s){
  const v=s.videos.find(x=>x.id===s.cv),key=v?s.id+v.id+v.vid:'';
  if(key===frameKey)return;
  killFrame();frameKey=key;pst=-1;curT=v?(v.pos||0):0;
  $('#ph').hidden=!!v;$('#zl').hidden=$('#zr').hidden=!v;
  if(!v)return;
  const p=v.done?0:Math.floor(v.pos||0);
  frame=document.createElement('iframe');
  frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
  frame.src='https://www.youtube.com/embed/'+v.vid+'?enablejsapi=1&rel=0&origin='+encodeURIComponent(location.origin)+(p>2?'&start='+p:'');
  const f=frame;f.onload=()=>{sub(f);setTimeout(()=>sub(f),1200);setTimeout(()=>{if(rate!==1)cmd(f,'setPlaybackRate',[rate])},1500)};
  $('#pstage').insertBefore(frame,$('#ph'));
}
function sub(f){try{f.contentWindow.postMessage(JSON.stringify({event:'listening',id:1,channel:'widget'}),'*')}catch(e){}}
function cmd(f,fn,args){try{f.contentWindow.postMessage(JSON.stringify({event:'command',func:fn,args:args||[]}),'*')}catch(e){}}
const probes=[];
function probe(v){
  const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-9999px;width:200px;height:120px;border:0';
  f.src='https://www.youtube.com/embed/'+v.vid+'?enablejsapi=1&origin='+encodeURIComponent(location.origin);
  f.onload=()=>{sub(f);setTimeout(()=>sub(f),1200)};document.body.appendChild(f);probes.push({f,v});
  setTimeout(()=>f.remove(),15000);
}
addEventListener('message',e=>{
  if(!/youtube/.test(e.origin))return;let d;try{d=JSON.parse(e.data)}catch(x){return}
  const i=d&&d.info;if(d.event!=='infoDelivery'||!i)return;
  const p=probes.find(p=>p.f.contentWindow===e.source);
  if(p){let ch=0;if(i.videoData&&i.videoData.title&&p.v.title.startsWith('فيديو ')){p.v.title=i.videoData.title;ch=1}
    if(i.duration>0&&!p.v.dur){p.v.dur=i.duration;ch=1}
    if(p.v.dur&&!p.v.title.startsWith('فيديو '))p.f.remove();
    if(ch){save();renderVL();upd()}return}
  if(!frame||e.source!==frame.contentWindow)return;
  const v=curV();if(!v)return;let ch=0;
  if(i.videoData&&i.videoData.title&&v.title.startsWith('فيديو ')){v.title=i.videoData.title;ch=1}
  if(i.duration>0&&Math.abs(i.duration-v.dur)>1){v.dur=i.duration;ch=1}
  if('playerState' in i)pst=i.playerState;
  if(typeof i.currentTime==='number'){
    const dl=i.currentTime-curT;
    if(i.playerState===1&&dl>0&&dl<3&&v.dur)v.watched=Math.min(v.dur,v.watched+dl);
    curT=i.currentTime;v.pos=curT;
    if(v.dur&&v.watched>=v.dur-2&&!v.done){v.done=true;ch=1}
  }
  if(i.playerState===0){if(!v.done)v.watched=v.dur||v.watched;v.done=true;v.pos=0;ch=1}
  save();if(ch)renderVL();upd();
});
/* ---- video controls ---- */
function togglePlay(){if(frame)cmd(frame,pst===1?'pauseVideo':'playVideo')}
function toast(side,t){const e=$('#tst');e.className='tst '+side+' on';e.textContent=t;clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),600)}
function seekBy(d){
  if(!frame)return;const v=curV();let t=Math.max(0,curT+d);if(v&&v.dur)t=Math.min(v.dur-1,t);
  cmd(frame,'seekTo',[t,true]);curT=t;if(v)v.pos=t;save();
  toast(d>0?'r':'l',(d>0?'+':'−')+Math.abs(d)+' ث');
}
const tp={t:0,d:0,tm:0};
function tap(d){
  const n=Date.now();clearTimeout(tp.tm);
  if(n-tp.t<350&&tp.d===d){tp.t=n;seekBy(d*10);return}
  tp.t=n;tp.d=d;tp.tm=setTimeout(togglePlay,320);
}
/* ---- files ---- */
let fvKey='',blobUrl=null;
function icon(it){if(!it.k)return'🔗';const m=it.mime||'';return m.startsWith('image')?'🖼️':m.startsWith('video')?'🎞️':m.startsWith('audio')?'🎵':m.includes('pdf')?'📕':/word|document/.test(m)?'📘':/sheet|excel/.test(m)?'📗':/presentation|powerpoint/.test(m)?'📙':'📄'}
function renderFL(){
  const s=cur();let h=s.items.length?'':'<p class="mut">لا توجد ملفات بعد.</p>';
  s.items.forEach((it,i)=>{h+=`<div class="item ${s.ci===it.id?'on':''}" draggable="true" data-fi="${i}"><div class="th" style="width:40px;height:40px">${icon(it)}</div><div class="meta"><div>${esc(it.name)}</div><div class="mut">${it.k?(it.size/1048576).toFixed(2)+' MB':'رابط'}</div></div><div class="col"><button class="sm" data-fu="${i}">▲</button><button class="sm" data-fd="${i}">▼</button><button class="sm" data-fr="${i}">✕</button></div></div>`});
  $('#fl').innerHTML=h;
  $$('[data-fi]').forEach(e=>{const i=+e.dataset.fi;
    e.onclick=()=>{s.ci=s.items[i].id;save();renderFL();showItem(s)};
    e.ondragstart=ev=>{ev.dataTransfer.setData('text/plain','f'+i);e.classList.add('drag')};
    e.ondragend=()=>e.classList.remove('drag');e.ondragover=ev=>ev.preventDefault();
    e.ondrop=ev=>{ev.preventDefault();ev.stopPropagation();const d=ev.dataTransfer.getData('text/plain');if(d[0]==='f'){mv(s.items,+d.slice(1),i);save();renderFL()}}});
  $$('[data-fu]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();mv(s.items,+e.dataset.fu,+e.dataset.fu-1);save();renderFL()});
  $$('[data-fd]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();mv(s.items,+e.dataset.fd,+e.dataset.fd+1);save();renderFL()});
  $$('[data-fr]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();const it=s.items.splice(+e.dataset.fr,1)[0];if(it.k)fdel(it.k);if(s.ci===it.id)s.ci=null;save();renderFL();showItem(s)});
}
async function up(files){
  const s=cur();
  for(const f of files){const k=uid()+uid();
    try{await fput(k,f)}catch(e){alert('تعذر حفظ الملف: '+f.name);continue}
    const it={id:uid(),k,name:f.name,mime:f.type,size:f.size,pos:0};s.items.push(it);s.ci=it.id}
  save();renderFL();showItem(s);
}
function drive(u){let m=u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);if(m)return`https://drive.google.com/file/d/${m[1]}/preview`;
  m=u.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);if(m)return`https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  m=u.match(/drive\.google\.com\/drive\/folders\/([\w-]+)/);if(m)return`https://drive.google.com/embeddedfolderview?id=${m[1]}#list`;return u}
async function showItem(s){
  const box=$('#fv'),it=s.items.find(x=>x.id===s.ci),key=it?s.id+it.id:'';
  if(key===fvKey)return;fvKey=key; /* same file => viewer untouched, position kept */
  if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null}
  if(!it){box.innerHTML='<div class="stage free">اختر ملفاً أو رابطاً لعرضه هنا</div>';return}
  if(!it.k){box.innerHTML=`<div class="stage free" style="flex-direction:column"><iframe src="${esc(drive(it.url))}" style="flex:1" allow="autoplay;fullscreen"></iframe></div><p class="mut">إن لم يظهر المحتوى فالموقع يمنع العرض داخل الصفحة. <a href="${esc(it.url)}" target="_blank" rel="noopener" style="color:var(--g)">افتحه في تبويب جديد ↗</a></p>`;return}
  let b;try{b=await fget(it.k)}catch(e){}
  if(fvKey!==key)return;
  if(!b){box.innerHTML='<div class="stage free">تعذر قراءة الملف.</div>';return}
  const m=it.mime||'',u=blobUrl=URL.createObjectURL(b);let h;
  if(m.startsWith('image'))h=`<img src="${u}" style="max-width:100%;max-height:100%">`;
  else if(m.startsWith('video'))h=`<video src="${u}" controls style="width:100%;height:100%"></video>`;
  else if(m.startsWith('audio'))h=`<audio src="${u}" controls></audio>`;
  else if(m.includes('pdf')||m.startsWith('text'))h=`<iframe src="${u}" style="flex:1"></iframe>`;
  else h=`<div style="text-align:center"><div style="font-size:48px">${icon(it)}</div><p>لا يمكن عرض هذه الصيغة في المتصفح.</p><a class="btn" style="text-decoration:none;display:inline-block" href="${u}" download="${esc(it.name)}">⬇ تحميل الملف</a></div>`;
  box.innerHTML=`<div class="stage free" style="padding:8px">${h}</div><p class="row"><a href="${u}" download="${esc(it.name)}" style="color:var(--g)">⬇ تحميل</a></p>`;
  const el=box.querySelector('video,audio');
  if(el){el.onloadedmetadata=()=>{if(it.pos>1)el.currentTime=it.pos};el.ontimeupdate=()=>{it.pos=el.currentTime;save()}}
}
/* ---- one-time bindings ---- */
$$('[data-pre]').forEach(e=>e.onclick=()=>setTotal(+e.dataset.pre));
$('#tc').onchange=e=>{let n=Math.round(+e.target.value);if(!(n>=1))n=1;if(n>240)n=240;setTotal(n)};
$('#tgo').onclick=()=>{const t=cur().tm;if(t.rem<=0)t.rem=t.total*60;t.run=!t.run;save();renderTimer();upd()};
$('#trs').onclick=()=>{const t=cur().tm;t.run=false;t.rem=t.total*60;save();renderTimer();upd()};
$$('[data-tab]').forEach(e=>e.onclick=()=>{S.tab=e.dataset.tab;save();applyTab()});
$('#va').onclick=addVideo;$('#vu').onkeydown=e=>{if(e.key==='Enter')addVideo()};
$('#zl').onclick=()=>tap(-1);$('#zr').onclick=()=>tap(1);
$('#cb').onclick=()=>seekBy(-10);$('#cf').onclick=()=>seekBy(10);$('#cp').onclick=togglePlay;
$('#cs').onclick=()=>{const r=[.75,1,1.25,1.5,2];rate=r[(r.indexOf(rate)+1)%r.length];$('#cs').textContent=rate+'x';if(frame)cmd(frame,'setPlaybackRate',[rate])};
$('#cm').onclick=()=>{muted=!muted;$('#cm').textContent=muted?'🔇':'🔊';if(frame)cmd(frame,muted?'mute':'unMute')};
$('#cz').onclick=()=>{try{$('#pstage').requestFullscreen()}catch(e){}};
addEventListener('keydown',e=>{
  if(S.tab!=='v'||!frame||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(e.key==='ArrowRight')seekBy(10);else if(e.key==='ArrowLeft')seekBy(-10);else if(e.key===' '||e.key==='k'){e.preventDefault();togglePlay()}
});
const dz=$('#dz'),fi=$('#fi');
dz.onclick=()=>fi.click();fi.onchange=()=>{up(fi.files);fi.value=''};
dz.ondragover=e=>{e.preventDefault();dz.classList.add('hot')};dz.ondragleave=()=>dz.classList.remove('hot');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('hot');if(e.dataTransfer.files.length)up(e.dataTransfer.files)};
$('#la').onclick=()=>{const s=cur();let u=$('#lu').value.trim();if(!u)return;if(!/^https?:\/\//i.test(u))u='https://'+u;
  const it={id:uid(),name:$('#lt').value.trim()||u.replace(/^https?:\/\//,'').slice(0,40),url:u};
  s.items.push(it);s.ci=it.id;$('#lt').value=$('#lu').value='';save();renderFL();showItem(s)};
addEventListener('pagehide',()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}});
if(!S.active&&S.subs[0])S.active=S.subs[0].id;
if(S.tab!=='f')S.tab='v';
S.subs.forEach(s=>s.tm&&(s.tm.run=false));
render();
