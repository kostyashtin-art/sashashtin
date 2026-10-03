const cfg=window.SUPABASE_CONFIG||{};
const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
let user=null, kicks=[], month=new Date(), loading=false;

const app=document.getElementById("app");
const $=s=>document.querySelector(s);
const fmtTime=d=>new Date(d).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const fmtDate=d=>new Date(d).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"});
const todayKey=()=>new Date().toDateString();

function layout(){
 app.innerHTML=`
 <div class="app">
  <header><div class="logo">♡</div><h1>Наш малыш</h1><p class="subtitle">Маленькие толчки, большие воспоминания</p></header>
  <main>
   <section class="card">
    <div class="today">Толчки сегодня</div>
    <div id="count" class="count">0</div>
    <button id="kick" class="kick"><span class="heart">♡</span>ТОЛЧОК<small>нажми, когда почувствуешь</small></button>
    <div class="actions"><button id="undo" class="btn white">↶ Отменить последний</button><button id="clear" class="btn danger">Удалить сегодня</button></div>
   </section>
   <section class="card">
    <div class="section-head"><h2>Последние движения</h2><a class="link" href="#month">За месяц →</a></div>
    <div id="recent" class="list"></div>
   </section>
   <section id="month" class="card">
    <div class="month-head"><button id="prev">‹</button><div id="monthName" class="month-name"></div><button id="next">›</button></div>
    <div class="stats">
      <div class="stat"><strong id="total">0</strong><span>движений</span></div>
      <div class="stat"><strong id="active">0</strong><span>активных дней</span></div>
      <div class="stat"><strong id="avg">0</strong><span>в среднем за день</span></div>
      <div class="stat"><strong id="max">0</strong><span>максимум за день</span></div>
    </div>
    <div id="chart" class="chart"></div>
    <div class="export-row"><button id="exportWord" class="btn primary export-btn">Скачать аналитику за месяц в Word</button></div>
   </section>
   <p class="notice">Записи хранятся в семейном дневнике один месяц, затем автоматически удаляются. Время сохраняется с точностью до секунды.</p>
  </main>
 </div>`;
}

function renderRecent(){
 const arr=kicks.filter(k=>new Date(k.created_at).toDateString()===todayKey()).slice(0,12);
 $("#recent").innerHTML=arr.length?arr.map(k=>`<div class="item"><div class="left"><div class="mini">♡</div><div><b>Движение</b><div class="time">${fmtDate(k.created_at)}</div></div></div><span class="time">${fmtTime(k.created_at)}</span></div>`).join(""):'<div class="notice">Сегодня пока нет записей ♡</div>';
}

function renderToday(){
 $("#count").textContent=kicks.filter(k=>new Date(k.created_at).toDateString()===todayKey()).length;
}

function renderMonth(){
 const y=month.getFullYear(),m=month.getMonth(),days=new Date(y,m+1,0).getDate();
 const c=Array(days).fill(0);
 kicks.forEach(k=>{const d=new Date(k.created_at);if(d.getFullYear()===y&&d.getMonth()===m)c[d.getDate()-1]++});
 const total=c.reduce((a,b)=>a+b,0),active=c.filter(Boolean).length,max=Math.max(0,...c);
 $("#monthName").textContent=month.toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
 $("#total").textContent=total;$("#active").textContent=active;$("#avg").textContent=active?(total/active).toFixed(1):"0";$("#max").textContent=max;
 $("#chart").innerHTML=c.map((v,i)=>{
  const date=new Date(y,m,i+1).toLocaleDateString("ru-RU",{day:"2-digit",month:"long"});
  return `<div class="bar ${v?"":"zero"}" data-date="${date}" data-count="${v}" style="height:${v?Math.max(6,v/(max||1)*130):4}px"></div>`;
}).join("");
document.querySelectorAll(".bar").forEach(bar=>{
  bar.addEventListener("mouseenter",e=>showChartTip(e.currentTarget));
  bar.addEventListener("mousemove",e=>moveChartTip(e));
  bar.addEventListener("mouseleave",hideChartTip);
});
}

async function cleanup(){
 try{ await db.rpc("cleanup_old_kicks"); }catch(e){ console.warn("cleanup:",e); }
}

async function load(){
 const {data,error}=await db.from("kicks").select("id,created_at").eq("family_id",cfg.familyId).order("created_at",{ascending:false}).limit(5000);
 if(error){console.error(error);$("#recent").innerHTML='<div class="notice error">Не удалось загрузить записи. Проверьте подключение Supabase.</div>';return}
 kicks=data||[];renderToday();renderRecent();renderMonth();
}

async function addKick(){
 if(loading)return;loading=true;
 const now=new Date();
 const {error}=await db.from("kicks").insert({family_id:cfg.familyId,created_at:now.toISOString(),created_by:user.id});
 loading=false;
 if(error){alert("Не удалось сохранить толчок: "+error.message);return}
 const b=$("#kick");b.classList.remove("pulse");void b.offsetWidth;b.classList.add("pulse");await load();
}

async function undo(){
 const own=kicks[0];if(!own)return;
 const {error}=await db.from("kicks").delete().eq("id",own.id);
 if(error)alert(error.message);else await load();
}

async function clearToday(){
 if(!confirm("Удалить все движения за сегодня?"))return;
 const s=new Date();s.setHours(0,0,0,0);const e=new Date(s);e.setDate(e.getDate()+1);
 const {error}=await db.from("kicks").delete().eq("family_id",cfg.familyId).gte("created_at",s.toISOString()).lt("created_at",e.toISOString());
 if(error)alert(error.message);else await load();
}

function bind(){
 $("#kick").onclick=addKick;$("#undo").onclick=undo;$("#clear").onclick=clearToday;
 $("#prev").onclick=()=>{month.setMonth(month.getMonth()-1);renderMonth()};
 $("#next").onclick=()=>{month.setMonth(month.getMonth()+1);renderMonth()};
 $("#exportWord").onclick=exportWord;
}

async function auth(){
 const {data:{session}}=await db.auth.getSession();
 if(session){user=session.user;return true}
 const {data,error}=await db.auth.signInAnonymously();
 if(error){app.innerHTML=`<div class="app"><section class="card"><h2>Нужно включить анонимный вход</h2><p class="muted">В Supabase открой Authentication → Sign In / Providers и включи Anonymous Sign-Ins. После этого обнови страницу.</p><p class="notice error">${error.message}</p></section></div>`;return false}
 user=data.user;return true;
}


let chartTip=null;
function ensureChartTip(){
  if(!chartTip){chartTip=document.createElement("div");chartTip.className="chart-tooltip";document.body.appendChild(chartTip);}
}
function showChartTip(el){
  ensureChartTip();
  const n=Number(el.dataset.count);
  chartTip.innerHTML=`<b>${el.dataset.date}</b><br>${n} ${pluralKicks(n)}`;
  chartTip.style.display="block";
}
function moveChartTip(e){
  if(!chartTip)return;
  let x=e.clientX+14,y=e.clientY+14;
  const r=chartTip.getBoundingClientRect();
  if(x+r.width>window.innerWidth-10)x=e.clientX-r.width-14;
  if(y+r.height>window.innerHeight-10)y=e.clientY-r.height-14;
  chartTip.style.left=x+"px";chartTip.style.top=y+"px";
}
function hideChartTip(){if(chartTip)chartTip.style.display="none"}
function pluralKicks(n){
  if(n%10===1&&n%100!==11)return "толчок";
  if([2,3,4].includes(n%10)&&![12,13,14].includes(n%100))return "толчка";
  return "толчков";
}
function monthData(){
  const y=month.getFullYear(),m=month.getMonth(),days=new Date(y,m+1,0).getDate(),c=Array(days).fill(0);
  kicks.forEach(k=>{const d=new Date(k.created_at);if(d.getFullYear()===y&&d.getMonth()===m)c[d.getDate()-1]++;});
  return {y,m,c,total:c.reduce((a,b)=>a+b,0),active:c.filter(Boolean).length,max:Math.max(0,...c)};
}
function exportWord(){
  const {y,m,c,total,active,max}=monthData();
  const avg=active?(total/active).toFixed(1):"0";
  const name=new Date(y,m,1).toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
  const rows=c.map((n,i)=>{
    const d=new Date(y,m,i+1).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"});
    return `<tr><td>${d}</td><td>${n}</td></tr>`;
  }).join("");
  const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#333;margin:40px}h1{color:#c65f82}
  table{border-collapse:collapse;width:100%;margin:15px 0}td,th{border:1px solid #ddd;padding:8px}
  th{background:#f9e4ec}.note{color:#777;font-size:11px;margin-top:25px}
  </style></head><body><h1>Аналитика движений малыша</h1>
  <p><b>Период:</b> ${name}</p><h2>Сводка</h2>
  <table><tr><th>Показатель</th><th>Значение</th></tr>
  <tr><td>Всего движений</td><td>${total}</td></tr>
  <tr><td>Активных дней</td><td>${active}</td></tr>
  <tr><td>Среднее за активный день</td><td>${avg}</td></tr>
  <tr><td>Максимум за день</td><td>${max}</td></tr></table>
  <h2>Движения по дням</h2><table><tr><th>Дата</th><th>Количество толчков</th></tr>${rows}</table>
  <p class="note">Отчёт сформирован автоматически из семейного дневника. Отдельные записи сохраняются с точностью до секунды.</p>
  </body></html>`;
  const blob=new Blob(["\ufeff",html],{type:"application/msword"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`Аналитика_движений_${y}-${String(m+1).padStart(2,"0")}.doc`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
async function start(){
 if(!cfg.url||!cfg.publishableKey||!cfg.familyId){app.innerHTML='<div class="app"><section class="card"><h2>Не настроено подключение</h2><p class="muted">Проверьте config.js.</p></section></div>';return}
 layout();
 const ok=await auth();if(!ok)return;
 bind();await cleanup();await load();
 db.channel("kicks-live").on("postgres_changes",{event:"*",schema:"public",table:"kicks",filter:`family_id=eq.${cfg.familyId}`},load).subscribe();
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
start();
