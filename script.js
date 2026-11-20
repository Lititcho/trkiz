const KEY='tarkeez.v1',MAXS=4,MAXV=10,STREAK_MIN=600; /* يوم الستريك = 10 دقائق تركيز */
const TZ=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Africa/Algiers'}catch(e){return 'Africa/Algiers'}})();
const NAVS=['study','progress','league','friends','shop'];
/* ---- cloud (Supabase) ---- */
const CFG=window.TRKIZ_CONFIG||{};
const sb=(window.supabase&&CFG.url&&CFG.key&&!/PASTE/.test(CFG.url+CFG.key))?window.supabase.createClient(CFG.url,CFG.key):null;
/* ---- كل حساب له مساحته المحلية الخاصة (المواد، الفيديوهات، الملفات)، والزائر له مساحة منفصلة ---- */
const LU='tarkeez.lastuser',ukey=id=>id?'tarkeez.u.'+id:KEY;
function readState(k){
  let x=null;try{x=JSON.parse(localStorage.getItem(k))}catch(e){}
  if(!x||!x.subs)x={subs:[],active:null,tab:'v'};
  x.nav=NAVS.includes(x.nav)?x.nav:'study';
  x.remind=x.remind||{on:false,time:'20:00',last:''};
  x.subs.forEach(s=>{s.focus=s.focus||0;if(s.tm)s.tm.run=false});
  if(!x.active&&x.subs[0])x.active=x.subs[0].id;
  if(x.tab!=='f')x.tab='v';
  return x;
}
let curKey=KEY;try{const l=sb&&localStorage.getItem(LU);if(l)curKey=ukey(l)}catch(e){}
let S=readState(curKey);
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),uid=()=>Math.random().toString(36).slice(2,9);
let st=0;function save(){clearTimeout(st);st=setTimeout(()=>{try{localStorage.setItem(curKey,JSON.stringify(S))}catch(e){}},300)}
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
const closeModal=()=>{const o=$('#ov'),m=o.querySelector('.modal');if(!m||m.classList.contains('out'))return;m.classList.add('out');setTimeout(()=>{if(o.querySelector('.modal.out'))o.innerHTML=''},200)};
function confirmBox(h,ok,yes){openModal(h+`<div class="row" style="margin-top:14px"><button class="btn" id="y">${yes||'نعم'}</button><button class="btn g" id="n">إلغاء</button></div>`,()=>{$('#n').onclick=closeModal;$('#y').onclick=()=>{closeModal();ok()}})}
function say(t){const e=document.createElement('div');e.className='say';e.innerHTML=`<div>${esc(t)}</div>`;document.body.appendChild(e);setTimeout(()=>e.remove(),3200)}
const ERR={not_authenticated:'سجّل دخولك أولاً',already_in_team:'أنت في فريق بالفعل',not_found:'الرمز غير صحيح',team_full:'الفريق ممتلئ (30 عضواً)',bad_name:'الاسم يجب أن يكون بين 2 و40 حرفاً',challenge_ended:'انتهى هذا التحدي',challenge_full:'التحدي ممتلئ'};
const errMsg=e=>{const m=(e&&e.message)||'';for(const k in ERR)if(m.includes(k))return ERR[k];return 'تعذّر تنفيذ الطلب، حاول مرة أخرى'};

/* ---- cloud (Supabase) ---- */


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
  if(S.tab==='f'&&frame)cmd(frame,'pauseVideo');if(S.tab==='f'&&pdfCur)setTimeout(()=>pdfCur&&pdfCur.relayout(true),30);
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
let rt=0;function afterLog(){clearTimeout(rt);rt=setTimeout(async()=>{if(!user)return;try{await loadProgress();syncBadges();renderStrip();if(S.nav==='progress')renderProgress($('#pg-progress'))}catch(e){}},800)}
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
  if(key===fvKey)return;fvKey=key;pdfDestroy(); /* same file => viewer untouched, position kept */
  if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null}
  if(!it){box.innerHTML='<div class="stage free">اختر ملفاً أو رابطاً لعرضه هنا</div>';return}
  if(!it.k){box.innerHTML=`<div class="stage free" style="flex-direction:column"><iframe src="${esc(drive(it.url))}" style="flex:1" allow="autoplay;fullscreen"></iframe><button class="fsx" aria-label="إغلاق">✕</button></div><p class="mut">إن لم يظهر المحتوى فالموقع يمنع العرض داخل الصفحة. <a href="${esc(it.url)}" target="_blank" rel="noopener" style="color:var(--g)">افتحه في تبويب جديد ↗</a> · <button class="lnk" id="fsb">⛶ ملء الشاشة</button></p>`;wireFs(box);return}
  let b;try{b=await fget(it.k)}catch(e){}
  if(fvKey!==key)return;
  if(!b){box.innerHTML='<div class="stage free">تعذر قراءة الملف.</div>';return}
  const m=it.mime||'',u=blobUrl=URL.createObjectURL(b);let h;
  if(m.startsWith('image'))h=`<img src="${u}" style="max-width:100%;max-height:100%">`;
  else if(m.startsWith('video'))h=`<video src="${u}" controls style="width:100%;height:100%"></video>`;
  else if(m.startsWith('audio'))h=`<audio src="${u}" controls></audio>`;
  else if(isPdf(it))h='<div class="mut">جارٍ فتح الملف…</div>';else if(m.startsWith('text'))h=`<iframe src="${u}" style="flex:1"></iframe>`;
  else h=`<div style="text-align:center"><div style="font-size:48px">${icon(it)}</div><p>لا يمكن عرض هذه الصيغة في المتصفح.</p><a class="btn" style="text-decoration:none;display:inline-block" href="${u}" download="${esc(it.name)}">⬇ تحميل الملف</a></div>`;
  const pdf=isPdf(it);box.innerHTML=`<div class="stage free" style="padding:${pdf?0:8}px">${h}<button class="fsx" aria-label="إغلاق">✕</button></div><p class="row"><a href="${u}" download="${esc(it.name)}" style="color:var(--g)">⬇ تحميل</a>${pdf?'':'<button class="lnk" id="fsb">⛶ ملء الشاشة</button>'}</p>`;wireFs(box);if(pdf)pdfView(box,b,key);
  const el=box.querySelector('video,audio');
  if(el){el.onloadedmetadata=()=>{if(it.pos>1)el.currentTime=it.pos};el.ontimeupdate=()=>{it.pos=el.currentTime;save()}}
}

/* =====================================================
   الحسابات · التقدم · الدوري · الأصدقاء
   ===================================================== */
const TIERS=[['🥉','برونزي'],['🥈','فضي'],['🥇','ذهبي'],['💎','ياقوتي'],['👑','ماسي']];
const WD=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const loadingCard='<div class="card empty mut">جارٍ التحميل…</div>';
function errCard(el,e){el.innerHTML=`<div class="card empty"><p>${errMsg(e)}</p><button class="btn g" id="rt">إعادة المحاولة</button></div>`;$('#rt').onclick=renderPage}
function gate(el,title){
  if(!sb){el.innerHTML=`<div class="card empty"><div class="em">🔌</div><h3>${title}</h3><p class="mut">هذه الميزة تحتاج ربط الموقع بقاعدة البيانات (ملف config.js).</p></div>`;return true}
  if(!user){el.innerHTML=`<div class="card empty"><div class="em">🔐</div><h3>${title}</h3><p class="mut">سجّل دخولك ليُحفظ تقدّمك على حسابك وتتنافس مع غيرك.</p><button class="btn" id="gl">تسجيل الدخول</button></div>`;$('#gl').onclick=authModal;return true}
  return false;
}
function renderNav(){
  $$('[data-nav]').forEach(e=>e.classList.toggle('on',e.dataset.nav===S.nav));
  NAVS.forEach(n=>$('#pg-'+n).hidden=S.nav!==n);
}
function go(n){S.nav=n;save();if(n!=='study'&&frame)cmd(frame,'pauseVideo');renderNav();renderPage()}
function renderPage(){
  if(S.nav==='progress')pageProgress();else if(S.nav==='league')pageLeague();else if(S.nav==='friends')pageFriends();else if(S.nav==='shop')pageShop();
  renderStrip();
}

/* ---- auth ---- */
const PROF_COLS='username,is_public,tier,display_name,avatar_url,badges,ref_code,coins,ref_count';
const ANON='طالب مجهول';
async function loadProfile(){
  if(!user)return;const id=user.id;
  try{
    let r=await sb.from('profiles').select(PROF_COLS).eq('id',id).maybeSingle();
    if(r.error)r=await sb.from('profiles').select('username,is_public,tier').eq('id',id).maybeSingle(); /* قبل تنفيذ ملف SQL الجديد */
    if(user&&user.id===id&&r.data)prof=r.data;
  }catch(e){}
}
const dname=p=>p?(p.display_name||p.username||''):'';
const avHtml=(p,cls)=>{const n=dname(p)||'؟';return`<span class="av ${cls||''}">${esc(n.slice(0,1).toUpperCase())}${p&&p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="" onerror="this.remove()">`:''}</span>`};
const refPending=()=>{try{return localStorage.getItem('trkiz.ref')}catch(e){return null}};
let refAsked=false;
async function afterAuth(){
  prof=null;P=null;
  if(user){await loadProfile();renderAcct();try{await loadProgress();syncBadges()}catch(e){}handlePendingJoin();claimRef()}
  else if(pj)say('سجّل دخولك للانضمام');
  renderAcct();renderPage();
  if(!user&&sb&&!refAsked&&refPending()){refAsked=true;say('أنشئ حساباً جديداً لتحصل على عملاتك الهدية 🎁');authModal('up')}
  else if(!user&&pj&&sb)authModal();
}
function renderAcct(){
  const el=$('#acct');let h='';
  if(sb&&!user)h+='<button class="auth-btn" id="li"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span>تسجيل الدخول</span></button>';
  if(user){
    if(prof&&prof.coins!=null)h+=`<button class="coin" id="cn" title="عملاتك · المتجر">🪙 <b>${prof.coins}</b></button>`;
    h+=`<button class="me" id="ma" aria-label="حسابي">${avHtml(prof)}<span class="un">${esc(dname(prof))}</span></button>`;
  }
  h+='<button class="icon" id="gear" aria-label="الإعدادات">⚙️</button>';
  el.innerHTML=h;
  if($('#li'))$('#li').onclick=()=>authModal();
  if($('#ma'))$('#ma').onclick=settings;
  if($('#cn'))$('#cn').onclick=()=>go('shop');
  $('#gear').onclick=settings;
}
/* الشارات المكتسبة تُزامَن مع الملف الشخصي ليراها الآخرون */
const bctx=()=>({...P,refs:(prof&&prof.ref_count)||0});
const earned=()=>P?BADGES.filter(b=>b[4](bctx())).map(b=>b[0]):[];
async function syncBadges(){
  if(!user||!prof||!P)return;
  const ids=earned(),old=prof.badges||[];
  if(ids.length===old.length&&ids.every(x=>old.includes(x)))return;
  prof.badges=ids;
  try{await sb.from('profiles').update({badges:ids}).eq('id',user.id)}catch(e){}
}
function authModal(m){
  let mode=m==='up'?'up':'in';
  const draw=()=>openModal(`<b style="font-size:20px">${mode==='in'?'تسجيل الدخول':'إنشاء حساب'}</b>
    <button class="gbtn" id="gg" type="button"><svg class="glogo" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>المتابعة بحساب Google</span></button>
    <div class="or mut">أو بالبريد الإلكتروني</div>
    <input id="em" type="email" dir="ltr" placeholder="you@email.com" autocomplete="email" aria-label="البريد الإلكتروني">
    <input id="pw" type="password" dir="ltr" placeholder="كلمة السر (6 أحرف على الأقل)" autocomplete="${mode==='in'?'current-password':'new-password'}" aria-label="كلمة السر">
    <div class="msg" id="am"></div>
    <button class="btn wide" id="ae">${mode==='in'?'دخول':'إنشاء الحساب'}</button>
    <div class="row" style="justify-content:space-between;margin-top:8px"><button class="lnk" id="sw">${mode==='in'?'ليس لدي حساب':'لدي حساب بالفعل'}</button>${mode==='in'?'<button class="lnk" id="fp">نسيت كلمة السر؟</button>':''}</div>`,()=>{
    const msg=(t,ok)=>{const m=$('#am');m.textContent=t;m.className='msg'+(ok?' ok':'')};
    const back=location.origin+location.pathname;
    $('#sw').onclick=()=>{mode=mode==='in'?'up':'in';draw()};
    $('#gg').onclick=async()=>{$('#gg').classList.add('busy');const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:back}});if(error){$('#gg').classList.remove('busy');msg('تعذّر الاتصال بـ Google')}};
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
    ${user?`<div class="prow"><label class="avpick" for="avf" title="تغيير الصورة">${avHtml(prof,'lg')}<span class="cam">📷</span></label><input type="file" id="avf" accept="image/*" hidden><div class="col" style="gap:8px"><button class="btn g s" id="avb" type="button">تغيير الصورة</button><button class="btn g s" id="avr" type="button" ${prof&&prof.avatar_url?'':'hidden'}>إزالة الصورة</button></div></div>
    <label class="fld">الاسم (يمكن أن يتكرر بين الناس)<input id="dn2" maxlength="30" value="${esc(prof&&prof.display_name||'')}" placeholder="اسمك الظاهر للآخرين"></label>
    <label class="fld">اسم المستخدم (فريد: لا يستعمله غيرك)<input id="un2" dir="ltr" maxlength="20" value="${esc(prof?prof.username:'')}"></label>
    <label class="chk"><input type="checkbox" id="pub" ${prof&&prof.is_public===false?'':'checked'}> أظهر اسمي للآخرين (وإلا يظهر «طالب مجهول»)</label>
    <button class="lnk" id="vp" type="button">👁 كيف يظهر ملفي للآخرين</button>`:''}
    <label class="chk"><input type="checkbox" id="rm" ${r.on?'checked':''}> ذكّرني يومياً بالمذاكرة</label>
    <label class="fld">وقت التذكير<input type="time" id="rt2" value="${r.time}"></label>
    <p class="mut">يعمل التذكير والموقع مفتوح (حتى في تبويب آخر). لا يمكنه إيقاظ الجهاز والموقع مغلق.</p>
    <div class="msg" id="sm"></div>
    <div class="row"><button class="btn" id="ss">حفظ</button><button class="btn g" id="sc">إغلاق</button><span class="sp"></span>${user?'<button class="btn g" id="lo">تسجيل الخروج</button>':''}</div>`,()=>{
    const msg=(t,ok)=>{const m=$('#sm');m.textContent=t;m.className='msg'+(ok?' ok':'')};
    $('#sc').onclick=closeModal;
    if($('#lo'))$('#lo').onclick=async()=>{await flush();await sb.auth.signOut();closeModal();say('تم تسجيل الخروج')};
    if(user){
      const paint=()=>{$('.avpick').innerHTML=avHtml(prof,'lg')+'<span class="cam">📷</span>';$('#avr').hidden=!(prof&&prof.avatar_url);renderAcct()};
      $('#avb').onclick=()=>$('#avf').click();
      $('#vp').onclick=()=>showProfile(prof&&prof.username,true);
      $('#avf').onchange=async e=>{
        const f=e.target.files[0];e.target.value='';if(!f)return;
        if(!/^image\//.test(f.type)||f.size>10485760){msg('اختر صورة أقل من 10 ميغابايت');return}
        msg('جارٍ رفع الصورة…',true);
        try{
          const b=await toAvatar(f),path=user.id+'/avatar.jpg';
          const {error}=await sb.storage.from('avatars').upload(path,b,{upsert:true,contentType:'image/jpeg',cacheControl:'3600'});if(error)throw error;
          const url=sb.storage.from('avatars').getPublicUrl(path).data.publicUrl+'?v='+Date.now();
          const {error:e2}=await sb.from('profiles').update({avatar_url:url}).eq('id',user.id);if(e2)throw e2;
          prof={...prof,avatar_url:url};paint();msg('تم تحديث الصورة',true);
        }catch(x){msg('تعذّر رفع الصورة (تأكد من تنفيذ ملف SQL)')}
      };
      $('#avr').onclick=async()=>{
        try{
          const {error}=await sb.from('profiles').update({avatar_url:null}).eq('id',user.id);if(error)throw error;
          try{await sb.storage.from('avatars').remove([user.id+'/avatar.jpg'])}catch(x){}
          prof={...prof,avatar_url:null};paint();msg('تمت إزالة الصورة',true);
        }catch(x){msg('تعذّرت الإزالة')}
      };
    }
    $('#ss').onclick=async()=>{
      if(user){
        const un=$('#un2').value.trim(),dn=$('#dn2').value.trim();
        if(!/^\S{3,20}$/.test(un)){msg('اسم المستخدم من 3 إلى 20 حرفاً بدون مسافات');return}
        const patch={username:un,display_name:dn||null,is_public:$('#pub').checked};
        const {error}=await sb.from('profiles').update(patch).eq('id',user.id);
        if(error){msg(error.code==='23505'?'اسم المستخدم محجوز، جرّب غيره':'تعذّر الحفظ');return}
        prof={...prof,...patch};renderAcct();
      }
      S.remind={on:$('#rm').checked,time:$('#rt2').value||'20:00',last:''};save();
      if(S.remind.on&&'Notification' in window&&Notification.permission==='default')Notification.requestPermission();
      closeModal();say('تم الحفظ');
    };
  });
}

/* ---- deep links: ?team=CODE / ?ch=CODE ---- */
let pj=null;try{pj=JSON.parse(localStorage.getItem('trkiz.join'))}catch(e){}
(function(){const q=new URLSearchParams(location.search),t=q.get('team'),c=q.get('ch'),r=q.get('ref');
  if(t||c){pj={t:t?'team':'ch',c:(t||c).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)};try{localStorage.setItem('trkiz.join',JSON.stringify(pj))}catch(e){}}
  if(r){try{localStorage.setItem('trkiz.ref',r.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12))}catch(e){}}
  if(t||c||r)history.replaceState(null,'',location.pathname)})();
function handlePendingJoin(){
  if(!pj||!user)return;const j=pj;pj=null;try{localStorage.removeItem('trkiz.join')}catch(e){}
  confirmBox(`<b>${j.t==='team'?'الانضمام إلى فريق':'الانضمام إلى تحدٍّ'}</b><p class="mut">الرمز: <span dir="ltr">${esc(j.c)}</span></p>`,async()=>{
    try{await rpc(j.t==='team'?'join_team':'join_challenge',{p_code:j.c});say('تم الانضمام');go('friends')}catch(e){say(errMsg(e))}
  },'انضم');
}

/* ---- progress: streak, XP, level, badges, weekly summary ---- */
async function loadProgress(){
  const rows=await rpc('my_daily',{p_days:400}),map={},subj=new Set();let total=0,dawn=0;
  rows.forEach(r=>{map[r.day]=(map[r.day]||0)+r.seconds;total+=r.seconds;dawn+=r.dawn_seconds;if(r.subject)subj.add(r.subject)});
  const xp=Math.floor(total/60),vals=Object.values(map);
  P={rows,map,total,dawn,streak:streakOf(map),best:bestOf(map),maxDay:Math.max(0,...vals),days:vals.filter(v=>v>=STREAK_MIN).length,subjects:subj.size,lvl:Math.floor(Math.sqrt(xp/25))+1};return P;
}
function streakOf(map){
  let k=dayKey(),n=0;if((map[k]||0)<STREAK_MIN)k=shift(k,-1);
  while((map[k]||0)>=STREAK_MIN){n++;k=shift(k,-1)}return n;
}
function bestOf(map){
  const ks=Object.keys(map).filter(k=>map[k]>=STREAK_MIN).sort();let best=0,run=0,prev=null;
  ks.forEach(k=>{run=prev&&shift(prev,1)===k?run+1:1;prev=k;if(run>best)best=run});return best;
}
const BADGES=[ /* [id, emoji, name, description, test] */
  ['first','🌱','أول خطوة','5 دقائق تركيز',p=>p.total>=300],
  ['h1','⏳','ساعة أولى','ساعة تركيز واحدة',p=>p.total>=3600],
  ['h10','⏱️','10 ساعات','10 ساعات تركيز',p=>p.total>=36000],
  ['h25','🎯','25 ساعة','25 ساعة تركيز',p=>p.total>=90000],
  ['h50','📚','50 ساعة','50 ساعة تركيز',p=>p.total>=180000],
  ['h100','🏆','100 ساعة','100 ساعة تركيز',p=>p.total>=360000],
  ['h250','🚀','250 ساعة','250 ساعة تركيز',p=>p.total>=900000],
  ['h500','👑','500 ساعة','500 ساعة تركيز',p=>p.total>=1800000],
  ['h1000','💎','ألف ساعة','1000 ساعة تركيز',p=>p.total>=3600000],
  ['s3','🔥','3 أيام','3 أيام متتالية',p=>p.best>=3],
  ['s7','🔥','أسبوع كامل','7 أيام متتالية',p=>p.best>=7],
  ['s14','⚡','أسبوعان','14 يوماً متتالية',p=>p.best>=14],
  ['s30','🌟','شهر كامل','30 يوماً متتالية',p=>p.best>=30],
  ['s60','🌠','شهران','60 يوماً متتالية',p=>p.best>=60],
  ['s100','☄️','100 يوم','100 يوم متتالية',p=>p.best>=100],
  ['d2','💪','يوم قوي','ساعتان تركيز في يوم واحد',p=>p.maxDay>=7200],
  ['d4','🦾','يوم خارق','4 ساعات تركيز في يوم واحد',p=>p.maxDay>=14400],
  ['d6','🧠','ماراثون','6 ساعات تركيز في يوم واحد',p=>p.maxDay>=21600],
  ['a10','📅','10 أيام ناجحة','10 أيام بلغت 10 دقائق فأكثر',p=>p.days>=10],
  ['a30','🗓️','30 يوماً ناجحاً','30 يوماً بلغت 10 دقائق فأكثر',p=>p.days>=30],
  ['a100','🏅','100 يوم ناجح','100 يوم بلغت 10 دقائق فأكثر',p=>p.days>=100],
  ['dawn','🌅','مذاكر الفجر','جلسة بين 4 و6 صباحاً',p=>p.dawn>0],
  ['sub3','🗂️','متعدد المواد','ذاكرت 3 مواد مختلفة',p=>p.subjects>=3],
  ['l5','⭐','المستوى 5','وصلت إلى المستوى 5',p=>p.lvl>=5],
  ['l10','🎖️','المستوى 10','وصلت إلى المستوى 10',p=>p.lvl>=10],
  ['inv1','🤝','داعٍ','دعوت صديقاً بنجاح',p=>p.refs>=1],
  ['inv5','🎉','سفير','دعوت 5 أصدقاء',p=>p.refs>=5]
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
  const bc=bctx(),got=BADGES.filter(b=>b[4](bc)),lock=BADGES.filter(b=>!b[4](bc));
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
    <h3>الشارات <span class="mut">${got.length} / ${BADGES.length}</span></h3>
    <div class="badges">${[...got,...lock].map(b=>{const g=b[4](bc);return`<div class="bd ${g?'got':'lock'}"><span class="e">${b[1]}</span><b>${esc(b[2])}</b><span class="mut">${esc(b[3])}</span></div>`}).join('')}</div>
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
      return`<div class="lb ${m.me?'me':''} ${z}"><span class="rk">${i+1}</span><span class="nm"${pfAttr(m)}>${esc(m.name)}${m.me?' (أنت)':''}</span><span class="zi">${z==='up'?'▲':z==='down'?'▼':''}</span><span class="mn">${hm(m.minutes*60)}</span></div>`}).join('')}</div>
    <div class="legend mut"><span>أول 5 يصعدون الأسبوع القادم</span><span class="dn">آخر 5 ينزلون (إن كان العدد 10 فأكثر)</span></div>
    <p class="mut">من ذاكر أقل من 10 دقائق في الأسبوع ينزل مستوى. الترتيب بدقائق التركيز الفعلية من المؤقت.</p>
  </div>`;bindProfiles(el);
}

/* ---- friends: team goal + friend challenges ---- */
const board=ms=>'<div class="lbs">'+ms.map((m,i)=>`<div class="lb ${m.me?'me':''}"><span class="rk">${i+1}</span><span class="nm"${pfAttr(m)}>${esc(m.name)}${m.me?' (أنت)':''}</span><span class="mn">${hm(m.minutes*60)}</span></div>`).join('')+'</div>';
const inviteLink=(k,c)=>location.origin+location.pathname+'?'+k+'='+c;
async function act(btn,fn){btn.disabled=true;try{await fn()}catch(e){say(errMsg(e))}btn.disabled=false}
async function pageFriends(){
  const el=$('#pg-friends');if(gate(el,'الفرق والتحديات'))return;
  el.innerHTML=loadingCard;
  let team,chs;try{[team,chs]=await Promise.all([rpc('my_team'),rpc('my_challenges'),loadProfile()])}catch(e){errCard(el,e);return}
  if(S.nav!=='friends')return;renderAcct();
  let h=refCard()+'<div class="two2"><div class="card"><h3>👥 فريقك</h3>';
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
  el.innerHTML=h;bindProfiles(el);if($('#rsh'))$('#rsh').onclick=()=>navigator.share({title:'تركيز',text:'ذاكر معي على «تركيز» واربح عملات 🎯',url:$('#rl').value}).catch(()=>{});
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
/* =====================================================
   مساحة كل حساب · الملفات الشخصية · الإحالة · المتجر · عارض PDF
   ===================================================== */
const REF_INV=50,REF_NEW=20; /* يجب أن تطابق دالة claim_referral في SQL */

/* ---- كل حساب له مواده: عند الدخول/الخروج نبدّل المساحة المحلية ---- */
function setSpace(id){
  try{if(id)localStorage.setItem(LU,id);else localStorage.removeItem(LU)}catch(e){}
  const k=ukey(id);if(k===curKey)return false;
  clearTimeout(st);
  S.subs.forEach(s=>s.tm&&(s.tm.run=false));
  try{localStorage.setItem(curKey,JSON.stringify(S))}catch(e){} /* احفظ مواد الحساب السابق كما هي */
  curKey=k;S=readState(k);
  pend.sec=0;pdfDestroy();stageFsOff();
  killFrame();fvKey='';
  if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null}
  $('#fv').innerHTML='';$('#vl').innerHTML='';
  closeModal();renderNav();render();
  return true;
}

/* ---- ملف شخصي لحساب آخر (من الدوري/الفرق) ---- */
const pfAttr=m=>m&&m.name&&m.name!==ANON?` data-pf="${esc(m.name)}" data-me="${m.me?1:0}"`:'';
const bindProfiles=el=>el.querySelectorAll('[data-pf]').forEach(e=>e.onclick=()=>showProfile(e.dataset.pf,e.dataset.me==='1'));
async function showProfile(un,isMe){
  if(!un||un===ANON){say('هذا الحساب خاص');return}
  openModal('<div class="mut" style="text-align:center;padding:20px 0">جارٍ التحميل…</div>');
  let p=null;
  try{p=isMe&&prof?{...prof,badges:earned()}:await rpc('public_profile',{p_username:un})}catch(e){}
  const card=$('#ov .modal:not(.out) .card');if(!card)return;
  if(!p){card.innerHTML='<p style="text-align:center">تعذّر عرض هذا الملف (قد يكون خاصاً).</p><button class="btn g wide" id="pc">إغلاق</button>';$('#pc').onclick=closeModal;return}
  const ids=p.badges||[],list=BADGES.filter(b=>ids.includes(b[0]));
  card.innerHTML=`<div class="pf">${avHtml(p,'xl')}<h3>${esc(p.display_name||p.username)}</h3><div class="mut" dir="ltr">@${esc(p.username)}</div></div>
    <div class="mut" style="text-align:center;margin:12px 0">🏅 ${list.length} من ${BADGES.length} شارة</div>
    ${list.length?`<div class="badges pb">${list.map(b=>`<div class="bd got" title="${esc(b[3])}"><span class="e">${b[1]}</span><b>${esc(b[2])}</b></div>`).join('')}</div>`:'<p class="mut" style="text-align:center">لا توجد شارات بعد.</p>'}
    <button class="btn g wide" id="pc" style="margin-top:14px">إغلاق</button>`;
  $('#pc').onclick=closeModal;
}

/* ---- صورة الملف الشخصي: قص مربع + تصغير 256px ---- */
function toAvatar(file){return new Promise((res,rej)=>{
  const img=new Image(),u=URL.createObjectURL(file);
  img.onload=()=>{const n=256,c=document.createElement('canvas');c.width=c.height=n;
    const m=Math.min(img.width,img.height),sx=(img.width-m)/2,sy=(img.height-m)/2;
    c.getContext('2d').drawImage(img,sx,sy,m,m,0,0,n,n);URL.revokeObjectURL(u);
    c.toBlob(b=>b?res(b):rej(),'image/jpeg',.86)};
  img.onerror=()=>{URL.revokeObjectURL(u);rej()};img.src=u})}

/* ---- رابط الإحالة والعملات ---- */
function refCard(){
  if(!prof||!prof.ref_code)return'';
  const link=location.origin+location.pathname+'?ref='+prof.ref_code,n=prof.ref_count||0;
  return`<div class="card refc"><div class="row" style="flex-wrap:nowrap"><div style="font-size:38px">🎁</div><div><h3 style="margin:0 0 4px">ادعُ أصدقاءك واربح عملات</h3><div class="mut">كل صديق يسجّل عبر رابطك: تربح <b>${REF_INV}</b> 🪙 ويربح هو <b>${REF_NEW}</b> 🪙.</div></div></div>
    <div class="row" style="margin-top:12px"><input id="rl" readonly dir="ltr" value="${esc(link)}" style="flex:1" aria-label="رابط الإحالة" onfocus="this.select()"><button class="btn" data-copy="${esc(link)}">نسخ</button>${navigator.share?'<button class="btn g" id="rsh">مشاركة</button>':''}</div>
    <div class="mut" style="margin-top:8px">أصدقاء دعوتهم: <b>${n}</b> · رصيدك: <b>🪙 ${prof.coins||0}</b></div></div>`;
}
async function claimRef(){
  const c=refPending();if(!c||!user)return;
  try{const n=await rpc('claim_referral',{p_code:c});say(`🎉 حصلت على ${n} عملة هدية`)}
  catch(e){if(/fetch|network/i.test((e&&e.message)||''))return} /* أخطاء الشبكة: نعيد المحاولة لاحقاً */
  try{localStorage.removeItem('trkiz.ref')}catch(e){}
  await loadProfile();renderAcct();if(S.nav==='friends')pageFriends();
}

/* ---- المتجر (قريباً) ---- */
function pageShop(){
  const el=$('#pg-shop');
  const draw=()=>{el.innerHTML=`<div class="card empty soon"><div class="em float">🛍️</div><h3 style="font-size:26px;margin:8px 0">المتجر</h3><span class="pill">قريباً · Coming Soon</span>
    <p class="mut" style="max-width:440px;margin:16px auto 0">نجهّز لك متجراً تصرف فيه عملاتك على أشياء مميزة. اجمع العملات من الآن بدعوة أصدقائك من تبويب «الأصدقاء».</p>
    ${user&&prof&&prof.coins!=null?`<div class="bigcoin">🪙 <b>${prof.coins}</b></div>`:''}</div>`};
  draw();
  if(user)loadProfile().then(()=>{if(S.nav==='shop'){renderAcct();draw()}});
}

/* ---- ملء الشاشة للملفات (يعمل في الهاتف أيضاً) ---- */
function stageFs(st,on){if(!st)return;st.classList.toggle('fs',on);document.body.classList.toggle('nos',on);if(pdfCur)setTimeout(()=>pdfCur&&pdfCur.relayout(true),30)}
function stageFsOff(){const f=document.querySelector('.stage.fs');if(f)stageFs(f,false);document.body.classList.remove('nos')}
function wireFs(box){const st=box.querySelector('.stage'),x=box.querySelector('.fsx'),b=box.querySelector('#fsb');if(x)x.onclick=()=>stageFs(st,false);if(b)b.onclick=()=>stageFs(st,true)}

/* ---- عارض PDF (PDF.js): زوم + سحب + قرص بإصبعين + ملء الشاشة ---- */
let pdfCur=null,pdfLoad=null,pdfRz=0;
const isPdf=it=>/pdf/i.test(it.mime||'')||/\.pdf$/i.test(it.name||'');
function pdfDestroy(){if(pdfCur){try{pdfCur.destroy()}catch(e){}pdfCur=null}}
function loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  return pdfLoad||(pdfLoad=new Promise((res,rej)=>{
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res(window.pdfjsLib)};
    s.onerror=()=>{pdfLoad=null;rej(new Error('pdfjs'))};document.head.appendChild(s)}));
}
async function pdfView(box,blob,key){
  const stage=box.querySelector('.stage');if(!stage)return;
  const fallback=()=>{if(fvKey!==key)return;stage.innerHTML=`<iframe src="${blobUrl}" style="flex:1"></iframe><button class="fsx" aria-label="إغلاق">✕</button>`;wireFs(box)};
  let doc;
  try{const lib=await loadPdfJs();doc=await lib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise}catch(e){fallback();return}
  if(fvKey!==key){try{doc.destroy()}catch(e){}return}
  stage.innerHTML=`<div class="pdfv" dir="ltr"><div class="pdft"><button class="btn g s" data-z="-" aria-label="تصغير">−</button><span class="mut zl">100%</span><button class="btn g s" data-z="+" aria-label="تكبير">+</button><button class="btn g s" data-z="0">ملائمة</button><span class="sp"></span><span class="mut pgn">1 / ${doc.numPages}</span><button class="btn g s" data-z="fs" aria-label="ملء الشاشة">⛶</button></div><div class="pdfs"><div class="pdfp"></div></div></div>`;
  const sc=stage.querySelector('.pdfs'),host=stage.querySelector('.pdfp'),zl=stage.querySelector('.zl'),pgn=stage.querySelector('.pgn');
  let z=1,gen=0,io=null,pinch=null,lastW=-1,raf=0;
  const dpr=Math.min(2,window.devicePixelRatio||1),clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  async function layout(){
    const g=++gen,p1=await doc.getPage(1),v1=p1.getViewport({scale:1});
    if(g!==gen)return;
    lastW=sc.clientWidth;
    const w=Math.max(160,lastW-16)*z,h=Math.round(w*v1.height/v1.width);
    host.style.width=w+'px';host.innerHTML='';if(io)io.disconnect();
    io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)draw(e.target,g);else if(e.target.firstChild){e.target.replaceChildren();e.target.dataset.g=''}}),{root:sc,rootMargin:'700px 0px'});
    for(let i=1;i<=doc.numPages;i++){const d=document.createElement('div');d.className='pg';d.dataset.n=i;d.style.height=h+'px';host.appendChild(d);io.observe(d)}
    zl.textContent=Math.round(z*100)+'%';
  }
  async function draw(d,g){
    if(d.dataset.g===String(g))return;d.dataset.g=g;
    try{
      const p=await doc.getPage(+d.dataset.n),v=p.getViewport({scale:1}),w=host.clientWidth,k=w/v.width;
      let s=k*dpr;const px=v.width*s*v.height*s;if(px>16e6)s*=Math.sqrt(16e6/px); /* حد ذاكرة الكانفاس في الهواتف */
      const vp=p.getViewport({scale:s}),c=document.createElement('canvas');
      c.width=Math.floor(vp.width);c.height=Math.floor(vp.height);c.style.width=w+'px';c.style.height=Math.round(v.height*k)+'px';
      await p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      if(g!==gen||d.dataset.g!==String(g))return;
      d.style.height=c.style.height;d.replaceChildren(c);
    }catch(e){}
  }
  async function setZoom(nz,cx,cy){
    nz=clamp(nz,.5,4);if(Math.abs(nz-z)<.001)return;
    const f=nz/z;if(cx==null)cx=sc.clientWidth/2;if(cy==null)cy=sc.clientHeight/2;
    const sx=sc.scrollLeft,sy=sc.scrollTop;z=nz;
    await layout();sc.scrollLeft=(sx+cx)*f-cx;sc.scrollTop=(sy+cy)*f-cy;
  }
  async function relayout(force){
    if(!force&&Math.abs(sc.clientWidth-lastW)<2)return; /* شريط المتصفح في الهاتف يغيّر الارتفاع فقط */
    const r=sc.scrollTop/Math.max(1,sc.scrollHeight);await layout();sc.scrollTop=r*sc.scrollHeight;
  }
  /* قرص بإصبعين */
  const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  sc.addEventListener('touchstart',e=>{if(e.touches.length===2){const r=sc.getBoundingClientRect();
    pinch={d:dist(e.touches),z0:z,f:1,mx:(e.touches[0].clientX+e.touches[1].clientX)/2-r.left,my:(e.touches[0].clientY+e.touches[1].clientY)/2-r.top}}},{passive:true});
  sc.addEventListener('touchmove',e=>{if(pinch&&e.touches.length===2){e.preventDefault();
    pinch.f=clamp(pinch.z0*dist(e.touches)/pinch.d,.5,4)/pinch.z0;
    host.style.transformOrigin=(sc.scrollLeft+pinch.mx-host.offsetLeft)+'px '+(sc.scrollTop+pinch.my-host.offsetTop)+'px';
    host.style.transform='scale('+pinch.f+')'}},{passive:false});
  const endPinch=()=>{if(!pinch)return;const p=pinch;pinch=null;host.style.transform='';if(Math.abs(p.f-1)>.02)setZoom(p.z0*p.f,p.mx,p.my)};
  sc.addEventListener('touchend',e=>{if(pinch&&e.touches.length<2)endPinch()});sc.addEventListener('touchcancel',endPinch);
  /* رقم الصفحة الحالية */
  sc.addEventListener('scroll',()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;
    const c=host.children,mid=sc.scrollTop+sc.clientHeight*.35;let n=c.length;
    for(let i=0;i<c.length;i++){if(c[i].offsetTop+c[i].offsetHeight>mid){n=i+1;break}}
    pgn.textContent=Math.max(1,n)+' / '+doc.numPages})},{passive:true});
  stage.querySelector('.pdft').onclick=e=>{const b=e.target.closest('[data-z]');if(!b)return;const k=b.dataset.z;
    if(k==='+')setZoom(z*1.25);else if(k==='-')setZoom(z/1.25);else if(k==='0')setZoom(1);
    else if(k==='fs')stageFs(stage,!stage.classList.contains('fs'))};
  pdfCur={relayout,destroy(){gen++;if(io)io.disconnect();try{doc.destroy()}catch(e){}}};
  layout();
}
addEventListener('resize',()=>{if(!pdfCur)return;clearTimeout(pdfRz);pdfRz=setTimeout(()=>pdfCur&&pdfCur.relayout(),250)});
addEventListener('keydown',e=>{if(e.key==='Escape')stageFsOff()});


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
addEventListener('pagehide',()=>{flush();try{localStorage.setItem(curKey,JSON.stringify(S))}catch(e){}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});

/* ---- start ---- */
renderNav();render();renderAcct();
if(sb){
  sb.auth.onAuthStateChange((ev,sess)=>{
    const nu=sess?sess.user:null;
    setTimeout(()=>{
      const changed=(nu?nu.id:null)!==(user?user.id:null);
      user=nu;setSpace(nu?nu.id:null); /* كل حساب = مواده الخاصة */
      if(ev==='PASSWORD_RECOVERY')recoveryModal();
      if(changed||ev==='INITIAL_SESSION'||ev==='PASSWORD_RECOVERY')afterAuth();
    },0);
  });
}else renderPage();
