const KEY='tarkeez.v1',MAXS=4,MAXV=10,STREAK_MIN=600; /* يوم الستريك = 10 دقائق تركيز */
const TZ=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Africa/Algiers'}catch(e){return 'Africa/Algiers'}})();
let S;
try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!S||!S.subs)S={subs:[],active:null,tab:'v'};
S.nav=S.nav||'study';
S.remind=S.remind||{on:false,time:'20:00',last:''};
S.subs.forEach(s=>{s.focus=s.focus||0});
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),uid=()=>Math.random().toString(36).slice(2,9);
let st=0;function save(){clearTimeout(st);st=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}},300)}
const cur=()=>S.subs.find(s=>s.id===S.active);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const fmt=s=>{s=Math.max(0,Math.round(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':':'')+(h?pad(m):m)+':'+pad(x)};
const hm=s=>{s=Math.max(0,Math.floor(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h} س ${m} د`:`${m} د`};
const mv=(a,i,j)=>{if(i===j||j<0||j>=a.length)return;a.splice(j,0,a.splice(i,1)[0])};
const dayKey=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const shift=(k,n)=>{const [y,m,d]=k.split('-').map(Number);return dayKey(new Date(y,m-1,d+n))};

/* ---- IndexedDB (files) ---- */
let dbp=null;
function db(){return dbp||(dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('tarkeez',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej()}catch(e){rej(e)}}))}
async function fput(k,b){const d=await db();return new Promise((r,j)=>{const t=d.transaction('f','readwrite');t.objectStore('f').put(b,k);t.oncomplete=r;t.onerror=j})}
async function fget(k){const d=await db();return new Promise((r,j)=>{const q=d.transaction('f').objectStore('f').get(k);q.onsuccess=()=>r(q.result);q.onerror=j})}
async function fdel(k){try{const d=await db();d.transaction('f','readwrite').objectStore('f').delete(k)}catch(e){}}

/* ---- generic UI helpers ---- */
function openModal(h,bind){const o=$('#ov');o.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="card">${h}</div></div>`;o.querySelector('.modal').onclick=e=>{if(e.target.classList.contains('modal'))closeModal()};if(bind)bind(o)}
const closeModal=()=>{$('#ov').innerHTML=''};
function confirmBox(h,ok,yes){openModal(h+`<div class="row" style="margin-top:14px"><button class="btn" id="y">${yes||'نعم'}</button><button class="btn g" id="n">إلغاء</button></div>`,()=>{$('#n').onclick=closeModal;$('#y').onclick=()=>{closeModal();ok()}})}
function say(t){const e=document.createElement('div');e.className='say';e.innerHTML=`<div>${esc(t)}</div>`;document.body.appendChild(e);setTimeout(()=>e.remove(),3200)}
const ERR={not_authenticated:'سجّل دخولك أولاً',already_in_team:'أنت في فريق بالفعل',not_found:'الرمز غير صحيح',team_full:'الفريق ممتلئ (30 عضواً)',bad_name:'الاسم يجب أن يكون بين 2 و40 حرفاً',challenge_ended:'انتهى هذا التحدي',challenge_full:'التحدي ممتلئ'};
const errMsg=e=>{const m=(e&&e.message)||'';for(const k in ERR)if(m.includes(k))return ERR[k];return 'تعذّر تنفيذ الطلب، حاول مرة أخرى'};

/* ---- cloud (Supabase) ---- */
const CFG=window.TRKIZ_CONFIG||{};
const sb=(window.supabase&&CFG.url&&CFG.key&&!/PASTE/.test(CFG.url+CFG.key))?window.supabase.createClient(CFG.url,CFG.key):null;
let user=null,prof=null,P=null;
async function rpc(fn,args){const {data,error}=await sb.rpc(fn,args||{});if(error)throw error;return data}

/* ---- subjects ---- */
function mk(name){return{id:uid(),name,videos:[],items:[],cv:null,ci:null,focus:0,exam:null,tm:{total:25,rem:1500,run:false}}}
function addSub(){const n=$('#ns').value.trim();if(!n||S.subs.length>=MAXS)return;const s=mk(n);S.subs.push(s);S.active=s.id;save();render()}
function askDel(id){const s=S.subs.find(x=>x.id===id);confirmBox(`<b>حذف «${esc(s.name)}»؟</b><p class="mut">سيتم حذف الفيديوهات والملفات والمؤقت الخاصة بهذه المادة نهائياً.</p>`,()=>{if(s.tm.run){s.tm.run=false;flush()}s.items.forEach(i=>i.k&&fdel(i.k));S.subs=S.subs.filter(x=>x!==s);if(S.active===id)S.active=S.subs[0]?S.subs[0].id:null;save();render()},'نعم، احذف')}
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
  renderTimer();renderExam();applyTab();renderVL();renderFL();mountPlayer(s);showItem(s);upd();
}
function applyTab(){
  $('#pv').hidden=S.tab!=='v';$('#pf').hidden=S.tab!=='f';
  $$('[data-tab]').forEach(e=>e.classList.toggle('on',e.dataset.tab===S.tab));
  if(S.tab==='f'&&frame)cmd(frame,'pauseVideo');
  if(S.tab==='v')$$('#fv video,#fv audio').forEach(m=>m.pause());
}

/* ---- exam mode (per subject, works offline) ---- */
function renderExam(){
  const s=cur(),el=$('#exam');if(!s)return;
  if(!s.exam){el.innerHTML='<button class="chip" id="ex">⏳ وضع الامتحان</button>';$('#ex').onclick=examModal;return}
  const e=s.exam,days=Math.round((new Date(e.date+'T00:00:00')-new Date(dayKey()+'T00:00:00'))/864e5);
  const done=Math.max(0,s.focus-e.base),goal=e.hours*3600,p=Math.min(100,Math.round(done/goal*100)),left=Math.max(0,goal-done);
  let main;
  if(days<0)main='<div class="grow"><b>انتهى موعد الامتحان</b><div class="mut">أزل الوضع أو حدّد موعداً جديداً.</div></div>';
  else{
    const per=days===0?Math.ceil(left/60):Math.ceil(left/60/days);
    main=`<div><div class="days">${days===0?'اليوم':days}</div><div class="mut">${days===0?'الامتحان':'يوم للامتحان'}</div></div>
      <div class="grow"><b>${left?(days===0?`متبقٍّ ${per} د من هدفك`:`المطلوب ${per} د يومياً`):'حققت هدفك 🎉'}</b>
      <div class="mut">أنجزت ${hm(done)} من هدف ${e.hours} ساعة (${p}%)</div><div class="bar tall"><i style="width:${p}%"></i></div></div>`;
  }
  el.innerHTML=`<div class="card">${main}<button class="btn g s" id="exe">تعديل</button><button class="btn g s" id="exd">إزالة</button></div>`;
  $('#exe').onclick=examModal;$('#exd').onclick=()=>{s.exam=null;save();renderExam()};
}
function examModal(){
  const s=cur(),e=s.exam;
  openModal(`<b style="font-size:20px">وضع الامتحان · ${esc(s.name)}</b>
    <label class="fld">تاريخ الامتحان<input type="date" id="xd" min="${dayKey()}" value="${e?e.date:''}"></label>
    <label class="fld">كم ساعة تريد أن تذاكر هذه المادة قبله؟<input type="number" id="xh" min="1" max="500" value="${e?e.hours:20}"></label>
    <div class="msg" id="xm"></div>
    <div class="row"><button class="btn" id="xs">حفظ</button><button class="btn g" id="xc">إلغاء</button></div>`,()=>{
    $('#xc').onclick=closeModal;
    $('#xs').onclick=()=>{
      const d=$('#xd').value,h=Math.round(+$('#xh').value);
      if(!d){$('#xm').textContent='اختر تاريخ الامتحان';return}
      if(!(h>=1&&h<=500)){$('#xm').textContent='الساعات بين 1 و500';return}
      s.exam={date:d,hours:h,base:e&&e.date?e.base:s.focus};
      if(e&&e.hours!==h&&e.base!==undefined)s.exam.base=e.base;
      save();closeModal();renderExam();
    };
  });
}

/* ---- timer (one running timer at a time; counts real elapsed time) ---- */
const pend={sec:0,subj:''};let lastTick=Date.now(),flushing=false,nextTry=0,tickN=0;
function renderTimer(){
  const t=cur().tm;
  $$('[data-pre]').forEach(e=>e.classList.toggle('on',+e.dataset.pre===t.total));
  if(document.activeElement!==$('#tc'))$('#tc').value=t.total;
  $('#tgo').textContent=t.run?'إيقاف مؤقت':'ابدأ';
}
function setTotal(m){const t=cur().tm;t.total=m;t.rem=m*60;t.run=false;flush();save();renderTimer();upd()}
setInterval(()=>{
  const now=Date.now(),dt=Math.min(120,Math.max(0,Math.round((now-lastTick)/1000)));lastTick=now;
  const r=S.subs.find(s=>s.tm.run);
  if(r&&dt){
    const t=r.tm,use=Math.min(dt,t.rem);
    t.rem-=use;r.focus=(r.focus||0)+use;
    if(sb&&user)pend.sec+=use;
    if(t.rem<=0){t.rem=0;t.run=false;flush();done(r)}
  }
  if(pend.sec>=60)flush();
  if(++tickN%30===0&&cur()&&cur().exam)renderExam();
  save();upd();
},1000);
async function flush(){
  if(!sb||!user||flushing||pend.sec<1||Date.now()<nextTry)return;
  const sec=pend.sec,subj=pend.subj||'عام';pend.sec=0;flushing=true;
  try{await rpc('log_session',{p_subject:subj,p_seconds:sec,p_tz:TZ});afterLog()}
  catch(e){pend.sec+=sec;nextTry=Date.now()+30000}
  finally{flushing=false}
}
let rt=0;function afterLog(){clearTimeout(rt);rt=setTimeout(async()=>{if(!user)return;try{await loadProgress();renderStrip();if(S.nav==='progress')renderProgress($('#pg-progress'))}catch(e){}},800)}
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
  $('#sf').textContent=s.focus>=60?'· تركيزك في هذه المادة: '+hm(s.focus):'';
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

/* =====================================================
   الحسابات · التقدم · الدوري · الأصدقاء
   ===================================================== */
const TIERS=[['🥉','برونزي'],['🥈','فضي'],['🥇','ذهبي'],['💎','ياقوتي'],['👑','ماسي']];
const WD=['أحد','إثن','ثلا','أرب','خمي','جمع','سبت'];
const loadingCard='<div class="card empty mut">جارٍ التحميل…</div>';
function errCard(el,e){el.innerHTML=`<div class="card empty"><p>${errMsg(e)}</p><button class="btn g" id="rt">إعادة المحاولة</button></div>`;$('#rt').onclick=renderPage}
function gate(el,title){
  if(!sb){el.innerHTML=`<div class="card empty"><div class="em">🔌</div><h3>${title}</h3><p class="mut">هذه الميزة تحتاج ربط الموقع بقاعدة البيانات (ملف config.js).</p></div>`;return true}
  if(!user){el.innerHTML=`<div class="card empty"><div class="em">🔐</div><h3>${title}</h3><p class="mut">سجّل دخولك ليُحفظ تقدّمك على حسابك وتتنافس مع غيرك.</p><button class="btn" id="gl">تسجيل الدخول</button></div>`;$('#gl').onclick=authModal;return true}
  return false;
}
function renderNav(){
  $$('[data-nav]').forEach(e=>e.classList.toggle('on',e.dataset.nav===S.nav));
  ['study','progress','league','friends'].forEach(n=>$('#pg-'+n).hidden=S.nav!==n);
}
function go(n){S.nav=n;save();if(n!=='study'&&frame)cmd(frame,'pauseVideo');renderNav();renderPage()}
function renderPage(){
  if(S.nav==='progress')pageProgress();else if(S.nav==='league')pageLeague();else if(S.nav==='friends')pageFriends();
  renderStrip();
}

/* ---- auth ---- */
async function loadProfile(){
  try{const {data}=await sb.from('profiles').select('username,is_public,tier').eq('id',user.id).maybeSingle();prof=data}catch(e){prof=null}
}
async function afterAuth(){
  prof=null;P=null;
  if(user){await loadProfile();try{await loadProgress()}catch(e){}handlePendingJoin()}
  else if(pj)say('سجّل دخولك للانضمام');
  renderAcct();renderPage();
  if(!user&&pj&&sb)authModal();
}
function renderAcct(){
  const el=$('#acct');let h='';
  if(sb&&!user)h+='<button class="btn s" id="li">تسجيل الدخول</button>';
  if(user)h+=`<button class="me" id="ma" aria-label="حسابي"><span class="av">${esc(((prof&&prof.username)||'؟').slice(0,1).toUpperCase())}</span><span class="un">${esc(prof?prof.username:'')}</span></button>`;
  h+='<button class="icon" id="gear" aria-label="الإعدادات">⚙️</button>';
  el.innerHTML=h;
  if($('#li'))$('#li').onclick=authModal;
  if($('#ma'))$('#ma').onclick=settings;
  $('#gear').onclick=settings;
}
function authModal(){
  let mode='in';
  const draw=()=>openModal(`<b style="font-size:20px">${mode==='in'?'تسجيل الدخول':'إنشاء حساب'}</b>
    <button class="btn g wide" id="gg" style="margin-top:14px">المتابعة بحساب Google</button>
    <div class="or mut">أو بالبريد الإلكتروني</div>
    <input id="em" type="email" dir="ltr" placeholder="you@email.com" autocomplete="email" aria-label="البريد الإلكتروني">
    <input id="pw" type="password" dir="ltr" placeholder="كلمة السر (6 أحرف على الأقل)" autocomplete="${mode==='in'?'current-password':'new-password'}" aria-label="كلمة السر">
    <div class="msg" id="am"></div>
    <button class="btn wide" id="ae">${mode==='in'?'دخول':'إنشاء الحساب'}</button>
    <div class="row" style="justify-content:space-between;margin-top:8px"><button class="lnk" id="sw">${mode==='in'?'ليس لدي حساب':'لدي حساب بالفعل'}</button>${mode==='in'?'<button class="lnk" id="fp">نسيت كلمة السر؟</button>':''}</div>`,()=>{
    const msg=(t,ok)=>{const m=$('#am');m.textContent=t;m.className='msg'+(ok?' ok':'')};
    const back=location.origin+location.pathname;
    $('#sw').onclick=()=>{mode=mode==='in'?'up':'in';draw()};
    $('#gg').onclick=async()=>{const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:back}});if(error)msg('تعذّر الاتصال بـ Google')};
    if($('#fp'))$('#fp').onclick=async()=>{const e=$('#em').value.trim();if(!e){msg('اكتب بريدك أولاً');return}
      const {error}=await sb.auth.resetPasswordForEmail(e,{redirectTo:back});msg(error?'تعذّر إرسال الرابط':'أرسلنا رابط إعادة التعيين إلى بريدك',!error)};
    $('#ae').onclick=async()=>{
      const e=$('#em').value.trim(),p=$('#pw').value;
      if(!/^\S+@\S+\.\S+$/.test(e)){msg('اكتب بريداً صحيحاً');return}
      if(p.length<6){msg('كلمة السر 6 أحرف على الأقل');return}
      $('#ae').disabled=true;
      try{
        if(mode==='in'){const {error}=await sb.auth.signInWithPassword({email:e,password:p});if(error)throw error;closeModal()}
        else{const {data,error}=await sb.auth.signUp({email:e,password:p,options:{emailRedirectTo:back}});if(error)throw error;
          if(data.session)closeModal();else msg('أرسلنا رابط التأكيد إلى بريدك. افتحه ثم ارجع وسجّل دخولك.',true)}
      }catch(x){const m=x.message||'';msg(/Invalid login/i.test(m)?'البريد أو كلمة السر غير صحيحة':/not confirmed/i.test(m)?'أكّد بريدك أولاً من الرابط الذي وصلك':/registered/i.test(m)?'هذا البريد مسجّل، سجّل دخولك':'تعذّر تنفيذ الطلب، حاول مرة أخرى')}
      $('#ae').disabled=false;
    };
  });
  draw();
}
function recoveryModal(){
  openModal(`<b style="font-size:20px">كلمة سر جديدة</b><input id="np" type="password" dir="ltr" placeholder="6 أحرف على الأقل" autocomplete="new-password"><div class="msg" id="rm2"></div><button class="btn wide" id="rs">حفظ</button>`,()=>{
    $('#rs').onclick=async()=>{const p=$('#np').value;if(p.length<6){$('#rm2').textContent='6 أحرف على الأقل';return}
      const {error}=await sb.auth.updateUser({password:p});if(error)$('#rm2').textContent='تعذّر الحفظ';else{closeModal();say('تم تغيير كلمة السر')}};
  });
}
function settings(){
  const r=S.remind;
  openModal(`<b style="font-size:20px">الإعدادات</b>
    ${user?`<label class="fld">اسمك في الترتيب (يمكن أن يكون مستعاراً)<input id="un2" maxlength="20" value="${esc(prof?prof.username:'')}"></label>
    <label class="chk"><input type="checkbox" id="pub" ${prof&&prof.is_public===false?'':'checked'}> أظهر اسمي للآخرين (وإلا يظهر «طالب مجهول»)</label>`:''}
    <label class="chk"><input type="checkbox" id="rm" ${r.on?'checked':''}> ذكّرني يومياً بالمذاكرة</label>
    <label class="fld">وقت التذكير<input type="time" id="rt2" value="${r.time}"></label>
    <p class="mut">يعمل التذكير والموقع مفتوح (حتى في تبويب آخر). لا يمكنه إيقاظ الجهاز والموقع مغلق.</p>
    <div class="msg" id="sm"></div>
    <div class="row"><button class="btn" id="ss">حفظ</button><button class="btn g" id="sc">إغلاق</button><span class="sp"></span>${user?'<button class="btn g" id="lo">تسجيل الخروج</button>':''}</div>`,()=>{
    $('#sc').onclick=closeModal;
    if($('#lo'))$('#lo').onclick=async()=>{await flush();await sb.auth.signOut();closeModal();say('تم تسجيل الخروج')};
    $('#ss').onclick=async()=>{
      const msg=t=>{$('#sm').textContent=t};
      if(user){
        const un=$('#un2').value.trim();
        if(!/^\S{3,20}$/.test(un)){msg('الاسم من 3 إلى 20 حرفاً بدون مسافات');return}
        const {error}=await sb.from('profiles').update({username:un,is_public:$('#pub').checked}).eq('id',user.id);
        if(error){msg(error.code==='23505'?'هذا الاسم محجوز، جرّب غيره':'تعذّر الحفظ');return}
        prof={...prof,username:un,is_public:$('#pub').checked};renderAcct();
      }
      S.remind={on:$('#rm').checked,time:$('#rt2').value||'20:00',last:''};save();
      if(S.remind.on&&'Notification' in window&&Notification.permission==='default')Notification.requestPermission();
      closeModal();say('تم الحفظ');
    };
  });
}

/* ---- deep links: ?team=CODE / ?ch=CODE ---- */
let pj=null;try{pj=JSON.parse(localStorage.getItem('trkiz.join'))}catch(e){}
(function(){const q=new URLSearchParams(location.search),t=q.get('team'),c=q.get('ch');
  if(t||c){pj={t:t?'team':'ch',c:(t||c).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)};try{localStorage.setItem('trkiz.join',JSON.stringify(pj))}catch(e){}history.replaceState(null,'',location.pathname)}})();
function handlePendingJoin(){
  if(!pj||!user)return;const j=pj;pj=null;try{localStorage.removeItem('trkiz.join')}catch(e){}
  confirmBox(`<b>${j.t==='team'?'الانضمام إلى فريق':'الانضمام إلى تحدٍّ'}</b><p class="mut">الرمز: <span dir="ltr">${esc(j.c)}</span></p>`,async()=>{
    try{await rpc(j.t==='team'?'join_team':'join_challenge',{p_code:j.c});say('تم الانضمام');go('friends')}catch(e){say(errMsg(e))}
  },'انضم');
}

/* ---- progress: streak, XP, level, badges, weekly summary ---- */
async function loadProgress(){
  const rows=await rpc('my_daily',{p_days:400}),map={};let total=0,dawn=0;
  rows.forEach(r=>{map[r.day]=(map[r.day]||0)+r.seconds;total+=r.seconds;dawn+=r.dawn_seconds});
  P={rows,map,total,dawn,streak:streakOf(map),best:bestOf(map)};return P;
}
function streakOf(map){
  let k=dayKey(),n=0;if((map[k]||0)<STREAK_MIN)k=shift(k,-1);
  while((map[k]||0)>=STREAK_MIN){n++;k=shift(k,-1)}return n;
}
function bestOf(map){
  const ks=Object.keys(map).filter(k=>map[k]>=STREAK_MIN).sort();let best=0,run=0,prev=null;
  ks.forEach(k=>{run=prev&&shift(prev,1)===k?run+1:1;prev=k;if(run>best)best=run});return best;
}
const BADGES=[
  ['🌱','أول خطوة','5 دقائق تركيز',p=>p.total>=300],
  ['⏱️','10 ساعات','10 ساعات تركيز',p=>p.total>=36000],
  ['📚','50 ساعة','50 ساعة تركيز',p=>p.total>=180000],
  ['🏆','100 ساعة','100 ساعة تركيز',p=>p.total>=360000],
  ['🔥','3 أيام','3 أيام متتالية',p=>p.best>=3],
  ['🔥','أسبوع كامل','7 أيام متتالية',p=>p.best>=7],
  ['🌟','شهر كامل','30 يوماً متتالية',p=>p.best>=30],
  ['🌅','مذاكر الفجر','جلسة بين 4 و6 صباحاً',p=>p.dawn>0]
];
async function pageProgress(){
  const el=$('#pg-progress');if(gate(el,'تقدّمك'))return;
  if(!P){el.innerHTML=loadingCard;try{await loadProgress()}catch(e){errCard(el,e);return}}
  if(S.nav!=='progress')return;renderProgress(el);
}
function renderProgress(el){
  if(!P||!el)return;
  const xp=Math.floor(P.total/60),lvl=Math.floor(Math.sqrt(xp/25))+1,lo=(lvl-1)**2*25,hi=lvl**2*25,lp=Math.round((xp-lo)/(hi-lo)*100);
  const today=P.map[dayKey()]||0,tp=Math.min(100,Math.round(today/STREAK_MIN*100)),need=Math.ceil((STREAK_MIN-today)/60);
  const ws=shift(dayKey(),-new Date().getDay());
  const days=[0,1,2,3,4,5,6].map(i=>({k:shift(ws,i),v:P.map[shift(ws,i)]||0,i}));
  const tw=days.reduce((a,d)=>a+d.v,0),lw=[0,1,2,3,4,5,6].reduce((a,i)=>a+(P.map[shift(ws,i-7)]||0),0);
  const act=days.filter(d=>d.v>=STREAK_MIN).length,mx=Math.max(1800,...days.map(d=>d.v));
  const bs={};P.rows.filter(r=>r.day>=ws&&r.day<=shift(ws,6)).forEach(r=>bs[r.subject]=(bs[r.subject]||0)+r.seconds);
  const top=Object.entries(bs).sort((a,b)=>b[1]-a[1])[0];
  const delta=!lw?'أول أسبوع لك':tw>=lw?`+${hm(tw-lw)} عن الأسبوع الماضي`:`−${hm(lw-tw)} عن الأسبوع الماضي`;
  el.innerHTML=`
  <div class="two2">
    <div class="card hero">
      <div class="ring" style="--p:${tp}"><div><span class="fl">🔥</span><span class="n">${P.streak}</span></div></div>
      <div>
        <h3>${P.streak?`ستريك ${P.streak} ${P.streak<11?'أيام':'يوماً'}`:'ابدأ ستريكك اليوم'}</h3>
        <div>${today>=STREAK_MIN?'أنجزت يومك. حافظت على السلسلة 👏':`ذاكر ${need} ${need<11?'دقائق':'دقيقة'} أخرى اليوم ${P.streak?'لتحافظ على السلسلة':'لتبدأ السلسلة'}.`}</div>
        <div class="mut" style="margin-top:6px">اليوم الناجح = 10 دقائق تركيز · أطول سلسلة لك: ${P.best}</div>
      </div>
    </div>
    <div class="card">
      <h3>المستوى ${lvl}</h3>
      <div class="row"><span class="big sm">${xp}</span><span class="mut">نقطة XP · كل دقيقة تركيز = نقطة</span></div>
      <div class="bar tall"><i style="width:${lp}%"></i></div>
      <div class="mut" style="margin-top:6px">باقي ${hi-xp} نقطة للمستوى ${lvl+1}</div>
    </div>
  </div>
  <div class="card">
    <h3>ملخص هذا الأسبوع</h3>
    <div class="row"><span class="big sm">${hm(tw)}</span><span class="mut">${delta}</span></div>
    <div class="mut">${act} ${act<11?'أيام':'يوماً'} ناجحة${top?` · أكثر مادة: ${esc(top[0])} (${hm(top[1])})`:''}</div>
    <div class="wk">${days.map(d=>`<div class="${d.v>=STREAK_MIN?'on':''} ${d.k===dayKey()?'today':''}"><i style="height:${Math.max(4,Math.round(d.v/mx*100))}%"></i><span>${WD[d.i]}</span></div>`).join('')}</div>
  </div>
  <div class="card">
    <h3>الشارات</h3>
    <div class="badges">${BADGES.map(b=>{const got=b[3](P);return`<div class="bd ${got?'got':'lock'}"><span class="e">${b[0]}</span><b>${b[1]}</b><span class="mut">${b[2]}</span></div>`}).join('')}</div>
  </div>`;
}
function renderStrip(){
  const el=$('#strip');
  if(!sb||!user||!P||S.nav!=='study'){el.hidden=true;return}
  const today=P.map[dayKey()]||0,risk=P.streak>0&&today<STREAK_MIN;
  el.hidden=false;el.className='strip'+(risk&&new Date().getHours()>=17?' warn':'');
  el.innerHTML=`<span>🔥 <b>${P.streak}</b> ${P.streak<11?'أيام':'يوماً'}</span><span>اليوم: ${Math.floor(today/60)} / 10 د</span><span class="sp"></span><button id="sp">تقدّمي</button>`;
  $('#sp').onclick=()=>go('progress');
}

/* ---- league ---- */
async function pageLeague(){
  const el=$('#pg-league');if(gate(el,'الدوري الأسبوعي'))return;
  el.innerHTML=loadingCard;
  let r;try{r=await rpc('join_league')}catch(e){errCard(el,e);return}
  if(S.nav!=='league')return;
  const n=r.members.length,t=TIERS[r.tier]||TIERS[0],left=Math.max(0,Math.ceil((new Date(r.week_end+'T23:59:59Z')-Date.now())/864e5));
  el.innerHTML=`<div class="card">
    <div class="tier"><span class="t-e">${t[0]}</span><div><h3 style="margin:0">الدوري ${t[1]}</h3><div class="mut">ينتهي الأسبوع بعد ${left} ${left<11?'أيام':'يوماً'} · ${n} ${n<11?'متنافسين':'متنافساً'}</div></div></div>
    <div class="lbs">${r.members.map((m,i)=>{
      const z=n>=10&&i<5?'up':(n>=10&&i>=n-5?'down':(n<10&&i<5&&n>1?'up':''));
      return`<div class="lb ${m.me?'me':''} ${z}"><span class="rk">${i+1}</span><span class="nm">${esc(m.name)}${m.me?' (أنت)':''}</span><span class="zi">${z==='up'?'▲':z==='down'?'▼':''}</span><span class="mn">${hm(m.minutes*60)}</span></div>`}).join('')}</div>
    <div class="legend mut"><span>أول 5 يصعدون الأسبوع القادم</span><span class="dn">آخر 5 ينزلون (إن كان العدد 10 فأكثر)</span></div>
    <p class="mut">من ذاكر أقل من 10 دقائق في الأسبوع ينزل مستوى. الترتيب بدقائق التركيز الفعلية من المؤقت.</p>
  </div>`;
}

/* ---- friends: team goal + friend challenges ---- */
const board=ms=>'<div class="lbs">'+ms.map((m,i)=>`<div class="lb ${m.me?'me':''}"><span class="rk">${i+1}</span><span class="nm">${esc(m.name)}${m.me?' (أنت)':''}</span><span class="mn">${hm(m.minutes*60)}</span></div>`).join('')+'</div>';
const inviteLink=(k,c)=>location.origin+location.pathname+'?'+k+'='+c;
async function act(btn,fn){btn.disabled=true;try{await fn()}catch(e){say(errMsg(e))}btn.disabled=false}
async function pageFriends(){
  const el=$('#pg-friends');if(gate(el,'الفرق والتحديات'))return;
  el.innerHTML=loadingCard;
  let team,chs;try{[team,chs]=await Promise.all([rpc('my_team'),rpc('my_challenges')])}catch(e){errCard(el,e);return}
  if(S.nav!=='friends')return;
  let h='<div class="two2"><div class="card"><h3>👥 فريقك</h3>';
  if(team){
    const goal=team.goal_hours*60,tot=team.members.reduce((a,m)=>a+m.minutes,0),p=Math.min(100,Math.round(tot/goal*100));
    h+=`<div class="row"><b style="font-size:20px">${esc(team.name)}</b><span class="sp"></span><button class="btn g s" data-copy="${esc(inviteLink('team',team.code))}">نسخ رابط الدعوة</button></div>
      <div class="mut">رمز الفريق: <b dir="ltr">${esc(team.code)}</b></div>
      <div class="row" style="margin-top:12px"><span class="big sm">${p}%</span><span class="mut">${hm(tot*60)} من ${team.goal_hours} ساعة هذا الأسبوع</span></div>
      <div class="bar tall"><i style="width:${p}%"></i></div>${board(team.members)}
      <button class="btn g s" id="lv" style="margin-top:14px">مغادرة الفريق</button>`;
  }else{
    h+=`<p class="mut">اجمعوا ساعات المذاكرة معاً نحو هدف أسبوعي مشترك.</p>
      <div class="cho"><b>إنشاء فريق</b><div class="row" style="margin-top:8px"><input id="f-tn" placeholder="اسم الفريق" maxlength="30" style="flex:1"><input id="f-tg" type="number" min="1" max="500" value="10" style="width:84px" aria-label="ساعات أسبوعياً"><span class="mut">ساعة/أسبوع</span><button class="btn" id="f-tc">إنشاء</button></div></div>
      <div class="cho"><b>الانضمام برمز</b><div class="row" style="margin-top:8px"><input id="f-tj" dir="ltr" placeholder="الرمز" maxlength="6" style="flex:1"><button class="btn" id="f-tjb">انضمام</button></div></div>`;
  }
  h+='</div><div class="card"><h3>⚔️ تحدّي صديق</h3>';
  if(chs.length)h+=chs.map(c=>{const over=c.ends<dayKey(new Date(Date.now()));return`<div class="cho"><div class="row"><b>${esc(c.title)}</b><span class="mut">${over?'انتهى':'ينتهي '+esc(c.ends)}</span><span class="sp"></span><button class="btn g s" data-copy="${esc(inviteLink('ch',c.code))}">نسخ الدعوة</button></div>${board(c.members)}</div>`}).join('');
  else h+='<p class="mut">تنافسوا في عدد دقائق التركيز خلال فترة محددة. أنشئ تحدياً وأرسل الرابط لصديقك.</p>';
  h+=`<div class="cho"><b>تحدٍّ جديد</b><div class="row" style="margin-top:8px"><input id="f-cn" placeholder="اسم التحدي" maxlength="40" style="flex:1"><select id="f-cd" aria-label="المدة"><option value="3">3 أيام</option><option value="7" selected>7 أيام</option><option value="14">14 يوماً</option></select><button class="btn" id="f-cc">إنشاء</button></div></div>
    <div class="cho"><b>الانضمام برمز</b><div class="row" style="margin-top:8px"><input id="f-cj" dir="ltr" placeholder="الرمز" maxlength="6" style="flex:1"><button class="btn" id="f-cjb">انضمام</button></div></div></div></div>`;
  el.innerHTML=h;
  $$('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);say('تم نسخ الرابط')}catch(e){prompt('انسخ الرابط:',b.dataset.copy)}});
  const again=()=>pageFriends();
  if(team)$('#lv').onclick=()=>confirmBox('<b>مغادرة الفريق؟</b>',()=>act($('#lv'),async()=>{await rpc('leave_team');again()}),'غادر');
  else{
    $('#f-tc').onclick=e=>act(e.target,async()=>{const c=await rpc('create_team',{p_name:$('#f-tn').value,p_goal_hours:+$('#f-tg').value||10});say('تم إنشاء الفريق · الرمز '+c);again()});
    $('#f-tjb').onclick=e=>act(e.target,async()=>{await rpc('join_team',{p_code:$('#f-tj').value});say('انضممت للفريق');again()});
  }
  $('#f-cc').onclick=e=>act(e.target,async()=>{const c=await rpc('create_challenge',{p_title:$('#f-cn').value,p_days:+$('#f-cd').value});say('تم إنشاء التحدي · الرمز '+c);again()});
  $('#f-cjb').onclick=e=>act(e.target,async()=>{await rpc('join_challenge',{p_code:$('#f-cj').value});say('انضممت للتحدي');again()});
}

/* ---- daily reminder (only while the site is open) ---- */
setInterval(()=>{
  const r=S.remind;if(!r.on)return;
  const n=new Date(),k=dayKey(n);if(r.last===k)return;
  if(pad(n.getHours())+':'+pad(n.getMinutes())<r.time)return;
  if(P&&(P.map[k]||0)>=STREAK_MIN){r.last=k;save();return}
  r.last=k;save();
  const msg='حان وقت جلسة المذاكرة'+(P&&P.streak?` · ستريكك ${P.streak} ${P.streak<11?'أيام':'يوماً'}`:'');
  try{if('Notification' in window&&Notification.permission==='granted')new Notification('تركيز 🎯',{body:msg})}catch(e){}
  const b=document.createElement('div');b.className='banner';b.innerHTML=`<div>🎯 ${esc(msg)}<button class="btn g" style="background:#fff">حسناً</button></div>`;
  b.querySelector('button').onclick=()=>b.remove();document.body.appendChild(b);setTimeout(()=>b.remove(),30000);
},30000);

/* ---- one-time bindings ---- */
$$('[data-nav]').forEach(e=>e.onclick=()=>go(e.dataset.nav));
$$('[data-pre]').forEach(e=>e.onclick=()=>setTotal(+e.dataset.pre));
$('#tc').onchange=e=>{let n=Math.round(+e.target.value);if(!(n>=1))n=1;if(n>240)n=240;setTotal(n)};
$('#tgo').onclick=()=>{
  const s=cur(),t=s.tm;
  if(t.run){t.run=false;flush()}
  else{S.subs.forEach(x=>{if(x!==s)x.tm.run=false});flush();pend.subj=s.name;if(t.rem<=0)t.rem=t.total*60;t.run=true;lastTick=Date.now()}
  save();renderTimer();upd();
};
$('#trs').onclick=()=>{const t=cur().tm;t.run=false;flush();t.rem=t.total*60;save();renderTimer();upd()};
$$('[data-tab]').forEach(e=>e.onclick=()=>{S.tab=e.dataset.tab;save();applyTab()});
$('#va').onclick=addVideo;$('#vu').onkeydown=e=>{if(e.key==='Enter')addVideo()};
$('#zl').onclick=()=>tap(-1);$('#zr').onclick=()=>tap(1);
$('#cb').onclick=()=>seekBy(-10);$('#cf').onclick=()=>seekBy(10);$('#cp').onclick=togglePlay;
$('#cs').onclick=()=>{const r=[.75,1,1.25,1.5,2];rate=r[(r.indexOf(rate)+1)%r.length];$('#cs').textContent=rate+'x';if(frame)cmd(frame,'setPlaybackRate',[rate])};
$('#cm').onclick=()=>{muted=!muted;$('#cm').textContent=muted?'🔇':'🔊';if(frame)cmd(frame,muted?'mute':'unMute')};
$('#cz').onclick=()=>{try{$('#pstage').requestFullscreen()}catch(e){}};
addEventListener('keydown',e=>{
  if(S.nav!=='study'||S.tab!=='v'||!frame||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(e.key==='ArrowRight')seekBy(10);else if(e.key==='ArrowLeft')seekBy(-10);else if(e.key===' '||e.key==='k'){e.preventDefault();togglePlay()}
});
const dz=$('#dz'),fi=$('#fi');
dz.onclick=()=>fi.click();fi.onchange=()=>{up(fi.files);fi.value=''};
dz.ondragover=e=>{e.preventDefault();dz.classList.add('hot')};dz.ondragleave=()=>dz.classList.remove('hot');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('hot');if(e.dataTransfer.files.length)up(e.dataTransfer.files)};
$('#la').onclick=()=>{const s=cur();let u=$('#lu').value.trim();if(!u)return;if(!/^https?:\/\//i.test(u))u='https://'+u;
  const it={id:uid(),name:$('#lt').value.trim()||u.replace(/^https?:\/\//,'').slice(0,40),url:u};
  s.items.push(it);s.ci=it.id;$('#lt').value=$('#lu').value='';save();renderFL();showItem(s)};
addEventListener('pagehide',()=>{flush();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});

/* ---- start ---- */
if(!S.active&&S.subs[0])S.active=S.subs[0].id;
if(S.tab!=='f')S.tab='v';
if(!['study','progress','league','friends'].includes(S.nav))S.nav='study';
S.subs.forEach(s=>s.tm&&(s.tm.run=false));
renderNav();render();renderAcct();
if(sb){
  sb.auth.onAuthStateChange((ev,sess)=>{
    user=sess?sess.user:null;
    setTimeout(()=>{if(ev==='PASSWORD_RECOVERY')recoveryModal();afterAuth()},0);
  });
}else renderPage();
