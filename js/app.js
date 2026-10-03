
(function(){
"use strict";
const cfg=window.SUPABASE_CONFIG||{};
const root=document.getElementById("app");
let db=null,user=null,kicks=[],month=new Date(),tip=null,busy=false;

function el(id){return document.getElementById(id)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function time(v){return new Date(v).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
function date(v){return new Date(v).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})}
function sameDay(v){return new Date(v).toDateString()===new Date().toDateString()}
function plural(n){return n%10===1&&n%100!==11?"толчок":([2,3,4].includes(n%10)&&![12,13,14].includes(n%100)?"толчка":"толчков")}

function render(){
root.innerHTML=`<div class="app">
<header><div class="logo">♡</div><h1>Наш малыш</h1><p class="subtitle">Маленькие толчки, большие воспоминания</p></header>
<section class="card">
<div class="today">Толчки сегодня</div><div id="count" class="count">0</div>
<button id="kick" class="kick"><span class="heart">♡</span>ТОЛЧОК<small>нажми, когда почувствуешь</small></button>
<div class="actions"><button id="undo" class="btn white">↶ Отменить последний</button><button id="clear" class="btn danger">Удалить сегодня</button></div>
<div id="status" class="notice"></div>
</section>
<section class="card"><div class="section-head"><h2>Последние движения</h2><span class="link">сегодня</span></div><div id="recent" class="list"></div></section>
<section class="card">
<div class="month-head"><button id="prev">‹</button><div id="monthName" class="month-name"></div><button id="next">›</button></div>
<div class="stats"><div class="stat"><strong id="total">0</strong><span>движений</span></div><div class="stat"><strong id="active">0</strong><span>активных дней</span></div><div class="stat"><strong id="avg">0</strong><span>среднее за активный день</span></div><div class="stat"><strong id="max">0</strong><span>максимум за день</span></div></div>
<div id="chart" class="chart"></div>
<button id="export" class="btn primary export">Скачать аналитику за месяц в Word</button>
</section>
<p class="notice">Дата и время каждого движения сохраняются с точностью до секунды. Записи старше одного месяца удаляются автоматически.</p>
</div>`;
bind();
}

function bind(){
el("kick").onclick=addKick;el("undo").onclick=undo;el("clear").onclick=clearToday;
el("prev").onclick=function(){month.setMonth(month.getMonth()-1);renderMonth()};
el("next").onclick=function(){month.setMonth(month.getMonth()+1);renderMonth()};
el("export").onclick=exportWord;
}

function status(msg,cls){const x=el("status");if(x){x.textContent=msg;x.className="notice "+(cls||"")}}

async function signIn(){
if(!window.supabase||!db)throw new Error("Не удалось загрузить Supabase. Обновите страницу.");
let s=await db.auth.getSession();
if(s.data&&s.data.session){user=s.data.session.user;return}
let r=await db.auth.signInAnonymously();
if(r.error)throw r.error;
user=r.data.user;
}

async function load(){
const r=await db.from("kicks").select("id,created_at,created_by").eq("family_id",cfg.familyId).order("created_at",{ascending:false}).limit(5000);
if(r.error)throw r.error;
kicks=r.data||[];renderToday();renderMonth();
}

function renderToday(){
const a=kicks.filter(k=>sameDay(k.created_at));el("count").textContent=a.length;
el("recent").innerHTML=a.length?a.slice(0,20).map(k=>`<div class="item"><div class="left"><div class="mini">♡</div><div><b>Движение</b><div class="time">${date(k.created_at)}</div></div></div><span class="time">${time(k.created_at)}</span></div>`).join(""):'<div class="notice">Сегодня пока нет записей ♡</div>';
}

function monthData(){
const y=month.getFullYear(),m=month.getMonth(),days=new Date(y,m+1,0).getDate(),c=Array(days).fill(0);
kicks.forEach(k=>{const d=new Date(k.created_at);if(d.getFullYear()===y&&d.getMonth()===m)c[d.getDate()-1]++});
return {y,m,c,total:c.reduce((a,b)=>a+b,0),active:c.filter(Boolean).length,max:Math.max(0,...c)}
}

function renderMonth(){
const d=monthData();el("monthName").textContent=new Date(d.y,d.m,1).toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
el("total").textContent=d.total;el("active").textContent=d.active;el("avg").textContent=d.active?(d.total/d.active).toFixed(1):"0";el("max").textContent=d.max;
el("chart").innerHTML=d.c.map((n,i)=>`<div class="bar ${n?"":"zero"} data-date="${new Date(d.y,d.m,i+1).toLocaleDateString("ru-RU",{day:"2-digit",month:"long"})}" data-count="${n}" style="height:${n?Math.max(7,n/(d.max||1)*140):4}px"></div>`).join("");
document.querySelectorAll(".bar").forEach(b=>{b.onmouseenter=showTip;b.onmousemove=moveTip;b.onmouseleave=hideTip});
}

function showTip(e){if(!tip){tip=document.createElement("div");tip.className="chart-tooltip";document.body.appendChild(tip)}const n=Number(e.currentTarget.dataset.count);tip.innerHTML=`<b>${e.currentTarget.dataset.date}</b><br>${n} ${plural(n)}`;tip.style.display="block";moveTip(e)}
function moveTip(e){if(!tip)return;let x=e.clientX+14,y=e.clientY+14,r=tip.getBoundingClientRect();if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;if(y+r.height>innerHeight-8)y=e.clientY-r.height-14;tip.style.left=x+"px";tip.style.top=y+"px"}
function hideTip(){if(tip)tip.style.display="none"}

async function addKick(){
if(busy)return;busy=true;status("Сохраняем…");
const now=new Date().toISOString();
const r=await db.from("kicks").insert({family_id:cfg.familyId,created_by:user.id,created_at:now});
busy=false;
if(r.error){status("Не удалось сохранить: "+r.error.message,"error");return}
const b=el("kick");b.classList.remove("pulse");void b.offsetWidth;b.classList.add("pulse");status("Сохранено: "+date(now)+" · "+time(now),"ok");await load();
}

async function undo(){
if(!kicks.length)return;const r=await db.from("kicks").delete().eq("id",kicks[0].id);if(r.error)status(r.error.message,"error");else await load();
}
async function clearToday(){
if(!confirm("Удалить все движения за сегодня?"))return;
const s=new Date();s.setHours(0,0,0,0);const e=new Date(s);e.setDate(e.getDate()+1);
const r=await db.from("kicks").delete().eq("family_id",cfg.familyId).gte("created_at",s.toISOString()).lt("created_at",e.toISOString());
if(r.error)status(r.error.message,"error");else await load();
}
async function cleanup(){
try{await db.rpc("cleanup_old_kicks")}catch(e){console.warn("cleanup_old_kicks:",e)}
}

function exportWord(){
const d=monthData(),name=new Date(d.y,d.m,1).toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
const rows=d.c.map((n,i)=>`<tr><td>${new Date(d.y,d.m,i+1).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})}</td><td>${n}</td></tr>`).join("");
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#333;margin:40px}h1{color:#c65f82}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #ddd;padding:8px}th{background:#f9e4ec}</style></head><body><h1>Аналитика движений малыша</h1><p><b>Период:</b> ${name}</p><table><tr><th>Показатель</th><th>Значение</th></tr><tr><td>Всего движений</td><td>${d.total}</td></tr><tr><td>Активных дней</td><td>${d.active}</td></tr><tr><td>Среднее за активный день</td><td>${d.active?(d.total/d.active).toFixed(1):"0"}</td></tr><tr><td>Максимум за день</td><td>${d.max}</td></tr></table><h2>По дням</h2><table><tr><th>Дата</th><th>Количество толчков</th></tr>${rows}</table></body></html>`;
const url=URL.createObjectURL(new Blob(["﻿",html],{type:"application/msword"})),a=document.createElement("a");a.href=url;a.download=`Аналитика_движений_${d.y}-${String(d.m+1).padStart(2,"0")}.doc`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

async function start(){
try{
if(!cfg.url||!cfg.publishableKey||!cfg.familyId)throw new Error("Не заполнен config.js.");
if(!window.supabase)throw new Error("Supabase не загрузился. Обновите страницу.");
db=window.supabase.createClient(cfg.url,cfg.publishableKey);
render();
await signIn();
await cleanup();
await load();
status("Синхронизация включена","ok");
db.channel("kicks-live").on("postgres_changes",{event:"*",schema:"public",table:"kicks",filter:"family_id=eq."+cfg.familyId},load).subscribe();
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}catch(e){
console.error(e);
if(!document.querySelector(".app"))render();
status("Ошибка подключения: "+(e.message||e),"error");
}
}
start();
})();