const KEY='tarkeez.v1',MAXS=4,MAXV=10;
let S;
try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!S||!S.subs)S={subs:[],active:null,tab:'v'};
const $=s=>document.querySelector(s),uid=()=>Math.random().toString(36).slice(2,9);
let st=0;function save(){clearTimeout(st);st=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}},300)}
const cur=()=>S.subs.find(s=>s.id===S.active);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>{s=Math.max(0,Math.round(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60,p=n=>String(n).padStart(2,'0');return (h?h+':':'')+(h?p(m):m)+':'+p(x)};
const mv=(a,i,j)=>{if(i===j||j<0||j>=a.length)return;a.splice(j,0,a.splice(i,1)[0])};
/* ---- IndexedDB for files ---- */
let dbp=null;
function db(){return dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('tarkeez',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej()}catch(e){rej(e)}}))}
async function fput(k,b){const d=await db();return new Promise((r,j)=>{const t=d.transaction('f','readwrite');t.objectStore('f').put(b,k);t.oncomplete=r;t.onerror=j})}
async function fget(k){const d=await db();return new Promise((r,j)=>{const q=d.transaction('f').objectStore('f').get(k);q.onsuccess=()=>r(q.result);q.onerror=j})}
async function fdel(k){try{const d=await db();d.transaction('f','readwrite').objectStore('f').delete(k)}catch(e){}}
/* ---- subjects ---- */
function mk(name){return{id:uid(),name,videos:[],items:[],cv:null,ci:null,tm:{total:25,rem:1500,run:false}}}
function addSub(){const i=$('#ns');const n=i.value.trim();if(!n||S.subs.length>=MAXS)return;const s=mk(n);S.subs.push(s);S.active=s.id;save();render()}
function askDel(id){const s=S.subs.find(x=>x.id===id);modal(`<b>حذف «${esc(s.name)}»؟</b><p class="mut">سيتم حذف الفيديوهات والملفات والمؤقت الخاصة بهذه المادة نهائياً.</p><div class="row"><button class="btn" id="y">نعم، احذف</button><button class="btn g" id="n">إلغاء</button></div>`,()=>{s.items.forEach(i=>i.k&&fdel(i.k));S.subs=S.subs.filter(x=>x!==s);if(S.active===id)S.active=S.subs[0]?S.subs[0].id:null;save();render()})}
function modal(h,ok){const o=$('#ov');o.innerHTML=`<div class="modal"><div class="card">${h}</div></div>`;$('#n').onclick=()=>o.innerHTML='';$('#y').onclick=()=>{o.innerHTML='';ok()}}
/* ---- render ---- */
let frame=null,frameKey='',blobUrl=null;
function render(){
  const a=$('#app'),s=cur();
  if(frame&&frame.parentNode)frame.parentNode.removeChild(frame);
  let h=`<div class="card row"><span>📘 المواد:</span>`;
  S.subs.forEach(x=>h+=`<div class="chip ${x.id===S.active?'on':''}" data-sub="${x.id}">${esc(x.name)}<b data-del="${x.id}">✕</b></div>`);
  h+=`<span class="sp"></span><input id="ns" placeholder="مادة جديدة..." maxlength="30" ${S.subs.length>=MAXS?'disabled':''}><button class="btn o" id="as" ${S.subs.length>=MAXS?'disabled':''}>+ إضافة</button><span class="mut">${S.subs.length} / ${MAXS}</span></div>`;
  if(!s){a.innerHTML=h+`<div class="card" style="text-align:center;padding:50px"><div style="font-size:48px">📚</div><h3>أضف مادتك الأولى من الشريط أعلاه</h3><p class="mut">كل مادة لها فيديوهاتها ومؤقتها وملفاتها المستقلة (حتى ${MAXS} مواد).</p></div>`;bind();return}
  h+=`<div class="tabs"><button class="tab ${S.tab==='v'?'on':''}" data-tab="v">🎬 الفيديوهات</button><button class="tab ${S.tab==='f'?'on':''}" data-tab="f">📂 التمارين والملفات</button></div>`;
  h+=S.tab==='v'?vidHTML(s):fileHTML(s);
  a.innerHTML=h;bind();
  if(S.tab==='v')mountPlayer(s);else showItem(s);
  upd();
}
function bind(){
  const q=(s,f)=>document.querySelectorAll(s).forEach(f);
  const as=$('#as');if(as){as.onclick=addSub;$('#ns').onkeydown=e=>{if(e.key==='Enter')addSub()}}
  q('[data-sub]',e=>e.onclick=()=>{S.active=e.dataset.sub;save();render()});
  q('[data-del]',e=>e.onclick=ev=>{ev.stopPropagation();askDel(e.dataset.del)});
  q('[data-tab]',e=>e.onclick=()=>{S.tab=e.dataset.tab;save();render()});
  const s=cur();if(!s)return;
  if(S.tab==='v')bindVid(s);else bindFiles(s);
}
/* ---- videos ---- */
function vidHTML(s){
  const t=s.tm;
  let h=`<div class="mut">📚 جلسة الدراسة</div><h2>${esc(s.name)}</h2><p class="mut" style="margin-top:0">أضف حتى ${MAXV} فيديوهات من يوتيوب وتابع تقدمك.</p>
  <div class="card row"><span class="big" id="tt">${fmt(t.rem)}</span>
  ${[15,25,45,60].map(m=>`<button class="chip ${t.total===m?'on':''}" data-pre="${m}">${m}د</button>`).join('')}
  <input id="tc" type="number" min="1" max="240" value="${t.total}" style="width:80px">
  <button class="btn" id="tgo">${t.run?'إيقاف مؤقت':'ابدأ'}</button><button class="btn g" id="trs">إعادة</button>
  <div class="bar"><i id="tb"></i></div></div>
  <div class="card"><div class="row"><span class="big" id="op">0%</span><span class="mut">من وقت الدراسة</span><span class="sp"></span><span class="mut" id="ot"></span></div><div class="bar" style="margin-top:10px;height:12px"><i id="ob"></i></div></div>
  <div class="main"><div id="stagebox"></div><div class="card"><div class="row"><input id="vu" placeholder="https://youtube.com/watch?v=..." style="flex:1" dir="ltr"><button class="btn" id="va">إضافة</button></div><div class="mut" style="margin:6px 4px">${s.videos.length} / ${MAXV}</div><div id="vl">`;
  s.videos.forEach((v,i)=>{h+=`<div class="item ${s.cv===v.id?'on':''}" draggable="true" data-vi="${i}"><div class="th"><img src="https://i.ytimg.com/vi/${v.vid}/mqdefault.jpg" onerror="this.remove()" alt=""></div><div class="meta"><div>${esc(v.title)}</div><div class="mut">${v.dur?fmt(v.dur):'—'}</div><div class="bar" style="height:5px;margin-top:4px"><i style="width:${pct(v)}%"></i></div>${v.done?'<div class="ok">✓ مكتمل</div>':''}</div><div class="col"><button class="sm" data-up="${i}">▲</button><button class="sm" data-dn="${i}">▼</button><button class="sm" data-rm="${i}">✕</button></div></div>`});
  return h+`</div></div></div>`;
}
const pct=v=>v.done?100:v.dur?Math.min(100,v.watched/v.dur*100):0;
function bindVid(s){
  const t=s.tm,q=(x,f)=>document.querySelectorAll(x).forEach(f);
  q('[data-pre]',e=>e.onclick=()=>{setTotal(s,+e.dataset.pre)});
  $('#tc').onchange=e=>{let n=Math.round(+e.target.value);if(!(n>=1))n=1;if(n>240)n=240;setTotal(s,n)};
  $('#tgo').onclick=()=>{if(t.rem<=0)t.rem=t.total*60;t.run=!t.run;save();render()};
  $('#trs').onclick=()=>{t.run=false;t.rem=t.total*60;save();render()};
  const add=()=>{const u=$('#vu').value,m=u.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
    if(!m){$('#vu').style.borderColor='#d33';return}
    if(s.videos.length>=MAXV)return;
    const v={id:uid(),vid:m[1],title:'فيديو '+(s.videos.length+1),dur:0,watched:0,done:false};
    s.videos.push(v);if(!s.cv)s.cv=v.id;save();probe(v);render()};
  $('#va').onclick=add;$('#vu').onkeydown=e=>{if(e.key==='Enter')add()};
  q('[data-vi]',e=>{const i=+e.dataset.vi;
    e.onclick=()=>{s.cv=s.videos[i].id;save();render()};
    e.ondragstart=ev=>{ev.dataTransfer.setData('text/plain','v'+i);e.classList.add('drag')};
    e.ondragend=()=>e.classList.remove('drag');
    e.ondragover=ev=>ev.preventDefault();
    e.ondrop=ev=>{ev.preventDefault();const d=ev.dataTransfer.getData('text/plain');if(d[0]==='v'){mv(s.videos,+d.slice(1),i);save();render()}}});
  q('[data-up]',e=>e.onclick=ev=>{ev.stopPropagation();mv(s.videos,+e.dataset.up,+e.dataset.up-1);save();render()});
  q('[data-dn]',e=>e.onclick=ev=>{ev.stopPropagation();mv(s.videos,+e.dataset.dn,+e.dataset.dn+1);save();render()});
  q('[data-rm]',e=>e.onclick=ev=>{ev.stopPropagation();const v=s.videos.splice(+e.dataset.rm,1)[0];if(s.cv===v.id)s.cv=s.videos[0]?s.videos[0].id:null;save();render()});
}
function setTotal(s,m){s.tm.total=m;s.tm.rem=m*60;s.tm.run=false;save();render()}
function mountPlayer(s){
  const box=$('#stagebox'),v=s.videos.find(x=>x.id===s.cv);
  if(!v){box.innerHTML='<div class="stage">▶ أضف فيديو للبدء</div>';return}
  const key=s.id+v.id;
  if(!frame||frameKey!==key){
    frame=document.createElement('iframe');frameKey=key;frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
    frame.src='https://www.youtube.com/embed/'+v.vid+'?enablejsapi=1&rel=0&origin='+encodeURIComponent(location.origin);
    frame.onload=()=>{sub(frame);setTimeout(()=>sub(frame),1200)};
  }
  box.innerHTML='<div class="stage"></div>';box.firstChild.appendChild(frame);
}
function sub(f){try{f.contentWindow.postMessage(JSON.stringify({event:'listening',id:1,channel:'widget'}),'*')}catch(e){}}
function cmd(f,fn){try{f.contentWindow.postMessage(JSON.stringify({event:'command',func:fn,args:[]}),'*')}catch(e){}}
const probes=[];
function probe(v){ /* hidden player to read title + duration */
  const f=document.createElement('iframe');f.style.cssText='position:fixed;left:-9999px;width:200px;height:120px;border:0';
  f.src='https://www.youtube.com/embed/'+v.vid+'?enablejsapi=1&origin='+encodeURIComponent(location.origin);
  f.onload=()=>{sub(f);setTimeout(()=>sub(f),1200)};document.body.appendChild(f);probes.push({f,v});
  setTimeout(()=>{f.remove()},15000);
}
let last=0;
addEventListener('message',e=>{
  if(!/youtube/.test(e.origin))return;let d;try{d=JSON.parse(e.data)}catch(x){return}
  const i=d&&d.info;if(d.event!=='infoDelivery'||!i)return;
  const p=probes.find(p=>p.f.contentWindow===e.source);
  if(p){let ch=0;if(i.videoData&&i.videoData.title&&p.v.title.startsWith('فيديو ')){p.v.title=i.videoData.title;ch=1}
    if(i.duration>0&&!p.v.dur){p.v.dur=i.duration;ch=1}
    if(p.v.dur&&!p.v.title.startsWith('فيديو ')){p.f.remove()}
    if(ch){save();if(S.tab==='v')render()}return}
  if(!frame||e.source!==frame.contentWindow)return;
  const s=cur();if(!s)return;const v=s.videos.find(x=>x.id===s.cv);if(!v)return;
  let ch=0;
  if(i.videoData&&i.videoData.title&&v.title.startsWith('فيديو ')){v.title=i.videoData.title;ch=1}
  if(i.duration>0&&Math.abs(i.duration-v.dur)>1){v.dur=i.duration;ch=1}
  if(i.playerState===1&&typeof i.currentTime==='number'){
    const dl=i.currentTime-last;if(dl>0&&dl<3&&v.dur){v.watched=Math.min(v.dur,v.watched+dl)}
    last=i.currentTime;
    if(v.dur&&v.watched>=v.dur-2&&!v.done){v.done=true;ch=1}
  }else if(typeof i.currentTime==='number')last=i.currentTime;
  if(i.playerState===0&&!v.done){v.done=true;v.watched=v.dur||v.watched;ch=1}
  save();if(ch&&S.tab==='v')render();else upd();
});
/* ---- progress + timer ---- */
function upd(){
  const s=cur();if(!s||S.tab!=='v')return;
  const tot=s.videos.reduce((a,v)=>a+(v.dur||0),0),w=s.videos.reduce((a,v)=>a+(v.done&&v.dur?v.dur:Math.min(v.watched,v.dur||v.watched)),0);
  const p=tot?Math.min(100,Math.round(w/tot*100)):0;
  const g=id=>document.getElementById(id);
  if(g('op')){g('op').textContent=p+'%';g('ob').style.width=p+'%';g('ot').textContent=`${s.videos.filter(v=>v.done).length} / ${s.videos.length} فيديوهات مكتملة · ${fmt(w)} من ${fmt(tot)}`}
  document.querySelectorAll('[data-vi]').forEach((e,i)=>{const v=s.videos[i];if(!v)return;e.querySelector('.bar i').style.width=pct(v)+'%'});
  if(g('tt')){g('tt').textContent=fmt(s.tm.rem);g('tb').style.width=(100-s.tm.rem/(s.tm.total*60)*100)+'%'}
}
setInterval(()=>{
  S.subs.forEach(s=>{const t=s.tm;if(!t.run)return;t.rem--;
    if(t.rem<=0){t.rem=0;t.run=false;done(s)}});
  save();upd();
},1000);
function done(s){
  if(s.id===S.active&&frame)cmd(frame,'pauseVideo');
  beep();
  const b=document.createElement('div');b.className='banner';
  b.innerHTML=`<div>⏰ انتهى الوقت! خذ استراحة${S.subs.length>1?' ('+esc(s.name)+')':''}<button class="btn g" style="background:#fff">حسناً</button></div>`;
  b.querySelector('button').onclick=()=>b.remove();document.body.appendChild(b);setTimeout(()=>b.remove(),30000);
  if(s.id===S.active)render();
}
function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)();[0,.35,.7].forEach(t=>{const o=c.createOscillator(),g=c.createGain();o.frequency.value=880;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(.3,c.currentTime+t);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+t+.3);o.start(c.currentTime+t);o.stop(c.currentTime+t+.3)})}catch(e){}}
/* ---- files ---- */
function fileHTML(s){
  let h=`<h2>التمارين والملفات — ${esc(s.name)}</h2><p class="mut" style="margin-top:0">اربط Google Drive أو أي موقع، أو ارفع ملفاتك مباشرة.</p>
  <div class="two"><div class="drop" id="dz"><div style="font-size:34px">📤</div><b>ارفع ملفاتك</b><div class="mut">أي صيغة: PDF، Word، PowerPoint، Excel، صور، فيديو، صوت… اسحبها هنا أو اضغط</div><input type="file" id="fi" multiple hidden></div>
  <div class="card"><b>🔗 إضافة رابط</b><div class="row" style="margin-top:10px"><input id="lt" placeholder="العنوان (مثال: تمارين الرياضيات)" style="width:100%"><input id="lu" dir="ltr" placeholder="https://drive.google.com/…" style="flex:1"><button class="btn" id="la">إضافة</button></div><div class="mut" style="margin-top:8px">لعرض ملفات Drive هنا، اجعل مشاركتها «أي شخص لديه الرابط».</div></div></div>
  <div class="main" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)"><div class="card" style="padding-top:6px">${s.items.length?'':'<p class="mut">لا توجد ملفات بعد.</p>'}`;
  s.items.forEach((it,i)=>{h+=`<div class="item ${s.ci===it.id?'on':''}" draggable="true" data-fi="${i}"><div class="th" style="width:40px;height:40px">${icon(it)}</div><div class="meta"><div>${esc(it.name)}</div><div class="mut">${it.k?(it.size/1048576).toFixed(2)+' MB':'رابط'}</div></div><div class="col"><button class="sm" data-fu="${i}">▲</button><button class="sm" data-fd="${i}">▼</button><button class="sm" data-fr="${i}">✕</button></div></div>`});
  return h+`</div><div id="fv"></div></div>`;
}
function icon(it){if(!it.k)return'🔗';const m=it.mime||'';return m.startsWith('image')?'🖼️':m.startsWith('video')?'🎞️':m.startsWith('audio')?'🎵':m.includes('pdf')?'📕':/word|document/.test(m)?'📘':/sheet|excel/.test(m)?'📗':/presentation|powerpoint/.test(m)?'📙':'📄'}
function bindFiles(s){
  const dz=$('#dz'),fi=$('#fi');
  dz.onclick=()=>fi.click();fi.onchange=()=>up(s,fi.files);
  dz.ondragover=e=>{e.preventDefault();dz.classList.add('hot')};dz.ondragleave=()=>dz.classList.remove('hot');
  dz.ondrop=e=>{e.preventDefault();dz.classList.remove('hot');if(e.dataTransfer.files.length)up(s,e.dataTransfer.files)};
  $('#la').onclick=()=>{let u=$('#lu').value.trim();if(!/^https?:\/\//i.test(u)){if(u)u='https://'+u;else return}
    s.items.push({id:uid(),name:$('#lt').value.trim()||u.replace(/^https?:\/\//,'').slice(0,40),url:u});s.ci=s.items[s.items.length-1].id;save();render()};
  const q=(x,f)=>document.querySelectorAll(x).forEach(f);
  q('[data-fi]',e=>{const i=+e.dataset.fi;
    e.onclick=()=>{s.ci=s.items[i].id;save();render()};
    e.ondragstart=ev=>{ev.dataTransfer.setData('text/plain','f'+i);e.classList.add('drag')};
    e.ondragend=()=>e.classList.remove('drag');e.ondragover=ev=>ev.preventDefault();
    e.ondrop=ev=>{ev.preventDefault();ev.stopPropagation();const d=ev.dataTransfer.getData('text/plain');if(d[0]==='f'){mv(s.items,+d.slice(1),i);save();render()}}});
  q('[data-fu]',e=>e.onclick=ev=>{ev.stopPropagation();mv(s.items,+e.dataset.fu,+e.dataset.fu-1);save();render()});
  q('[data-fd]',e=>e.onclick=ev=>{ev.stopPropagation();mv(s.items,+e.dataset.fd,+e.dataset.fd+1);save();render()});
  q('[data-fr]',e=>e.onclick=ev=>{ev.stopPropagation();const it=s.items.splice(+e.dataset.fr,1)[0];if(it.k)fdel(it.k);if(s.ci===it.id)s.ci=null;save();render()});
}
async function up(s,files){
  for(const f of files){const k=uid()+uid();
    try{await fput(k,f)}catch(e){alert('تعذر حفظ الملف: '+f.name);continue}
    const it={id:uid(),k,name:f.name,mime:f.type,size:f.size};s.items.push(it);s.ci=it.id}
  save();render();
}
function drive(u){let m=u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);if(m)return`https://drive.google.com/file/d/${m[1]}/preview`;
  m=u.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]+)/);if(m)return`https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  m=u.match(/drive\.google\.com\/drive\/folders\/([\w-]+)/);if(m)return`https://drive.google.com/embeddedfolderview?id=${m[1]}#list`;return u}
async function showItem(s){
  const box=$('#fv');if(!box)return;
  if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null}
  const it=s.items.find(x=>x.id===s.ci);
  if(!it){box.innerHTML='<div class="stage free">اختر ملفاً أو رابطاً لعرضه هنا</div>';return}
  if(!it.k){const u=drive(it.url);box.innerHTML=`<div class="stage free" style="flex-direction:column"><iframe src="${esc(u)}" style="flex:1" allow="autoplay;fullscreen"></iframe></div><p class="mut">إن لم يظهر المحتوى فالموقع يمنع العرض داخل الصفحة. <a href="${esc(it.url)}" target="_blank" rel="noopener" style="color:var(--g)">افتحه في تبويب جديد ↗</a></p>`;return}
  let b;try{b=await fget(it.k)}catch(e){}
  if(s.ci!==it.id)return;
  if(!b){box.innerHTML='<div class="stage free">تعذر قراءة الملف.</div>';return}
  blobUrl=URL.createObjectURL(b);const m=it.mime||'',u=blobUrl;let h;
  if(m.startsWith('image'))h=`<img src="${u}" style="max-width:100%;max-height:100%">`;
  else if(m.startsWith('video'))h=`<video src="${u}" controls style="width:100%;height:100%"></video>`;
  else if(m.startsWith('audio'))h=`<audio src="${u}" controls></audio>`;
  else if(m.includes('pdf')||m.startsWith('text'))h=`<iframe src="${u}" style="flex:1"></iframe>`;
  else h=`<div style="text-align:center"><div style="font-size:48px">${icon(it)}</div><p>لا يمكن عرض هذه الصيغة في المتصفح.</p><a class="btn" style="text-decoration:none;display:inline-block" href="${u}" download="${esc(it.name)}">⬇ تحميل الملف</a></div>`;
  box.innerHTML=`<div class="stage free" style="padding:8px">${h}</div><p class="row"><a href="${u}" download="${esc(it.name)}" style="color:var(--g)">⬇ تحميل</a></p>`;
}
if(!S.active&&S.subs[0])S.active=S.subs[0].id;
S.subs.forEach(s=>s.tm&&(s.tm.run=false));
render();
