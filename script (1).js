/* =====================================================================
   TripSplit script
   1. Data layer (localStorage)   4. Views (HTML for each screen)
   2. Helpers                     5. Modals and forms
   3. Calculations                6. Actions, events, confetti, start-up
   The whole app state lives in one object, S. Every change updates S,
   calls save(), then render() redraws the screen.
   ===================================================================== */

/* ============ 1. DATA LAYER (swap these two functions for Firebase later) ============ */
const KEY='tripsplit.v1'; // name under which data is stored in localStorage
// Expense categories: key -> [emoji, label]
const CATS={stay:['🏨','Stay'],food:['🍔','Food'],fuel:['⛽','Fuel'],transport:['🚕','Transport'],shopping:['🛍️','Shopping'],fun:['🎟️','Fun'],other:['✨','Other']};
const uid=()=>Math.random().toString(36).slice(2,9); // short random id
const today=()=>new Date().toISOString().slice(0,10); // today as YYYY-MM-DD

// Creates the demo data shown the first time the app opens
function seed(){
const m=['You','Aarav','Riya','Kabir'].map(n=>({id:uid(),name:n}));
// mk = make one demo expense; pi = index of payer, ids = indexes of people sharing it
const mk=(title,amt,cat,pi,ids)=>({id:uid(),title,amount:amt,cat,payer:m[pi].id,date:today(),mode:'equal',raw:{},shares:eq(amt,ids.map(i=>m[i].id))});
return{profile:{name:'You',calm:false},cur:null,notifs:[{id:uid(),t:Date.now(),msg:'Welcome to TripSplit! A demo trip is ready to explore.'}],
trips:[{id:uid(),name:'Goa Getaway',emoji:'🏖️',members:m,settlements:[],expenses:[
mk('Beach villa (2 nights)',12000,'stay',1,[0,1,2,3]),mk('Seafood dinner',3200,'food',0,[0,1,2,3]),mk('Petrol & tolls',2400,'fuel',2,[0,1,2,3]),mk('Scooter rentals',1500,'transport',3,[0,2,3])]}]};
}
// Read saved data; fall back to demo data if nothing valid is saved
function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&d.trips)return d}catch(e){}return seed()}
// Write the whole state to localStorage
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
let S=load();
// UI = what the user is looking at right now (not saved): tab, open trip, trip sub-tab, search text
let UI={tab:'home',trip:null,sub:'expenses',q:''};

/* ============ 2. HELPERS ============ */
// esc: makes text safe to put inside HTML (stops names like <b> from breaking the page)
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// fmt: formats a number as Indian rupees, e.g. 1200 -> ₹1,200
const fmt=n=>(n<0?'-':'')+'₹'+Math.abs(n).toLocaleString('en-IN',{maximumFractionDigits:2});
const r2=n=>Math.round(n*100)/100; // round to 2 decimals
const trip=id=>S.trips.find(t=>t.id===id); // find a trip by id
const mem=(t,id)=>t.members.find(m=>m.id===id)||{name:'?'}; // find a member of trip t
const ini=n=>esc((n.trim()[0]||'?').toUpperCase()); // first letter for avatars
// eq: split an amount equally in paise (cents) so the shares add up exactly; leftover paise go to the first people
function eq(amount,ids){const c=Math.round(amount*100),n=ids.length,b=Math.floor(c/n),r=c-b*n,o={};ids.forEach((id,i)=>o[id]=(b+(i<r?1:0))/100);return o}
// notify: add a message to the notifications list (keeps the latest 50)
function notify(msg){S.notifs.unshift({id:uid(),t:Date.now(),msg});S.notifs=S.notifs.slice(0,50)}
// toast: short message at the top of the screen that disappears after 2.4 seconds
function toast(msg){const d=document.createElement('div');d.className='toast';d.setAttribute('role','status');d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),2400)}

/* ============ 3. CALCULATIONS ============ */
// calc: for one trip returns how much each person paid, owes (their share) and their net balance
// net > 0 means the person should get money back; net < 0 means they owe money
function calc(t){
const paid={},owed={},net={};t.members.forEach(m=>{paid[m.id]=0;owed[m.id]=0});
t.expenses.forEach(e=>{paid[e.payer]=(paid[e.payer]||0)+e.amount;for(const k in e.shares)owed[k]=(owed[k]||0)+e.shares[k]});
t.members.forEach(m=>net[m.id]=r2(paid[m.id]-owed[m.id]));
// recorded settlements move money: the payer's balance goes up, the receiver's goes down
t.settlements.forEach(s=>{net[s.from]=r2(net[s.from]+s.amount);net[s.to]=r2(net[s.to]-s.amount)});
const total=t.expenses.reduce((a,e)=>a+e.amount,0);
return{paid,owed,net,total};
}
/* Greedy: repeatedly match the biggest debtor with the biggest creditor → at most (n-1) payments */
function suggest(net){
const cr=[],db=[];for(const id in net){if(net[id]>0.009)cr.push({id,a:net[id]});else if(net[id]<-0.009)db.push({id,a:-net[id]})}
const out=[];
while(cr.length&&db.length){cr.sort((a,b)=>b.a-a.a);db.sort((a,b)=>b.a-a.a);
const c=cr[0],d=db[0],x=r2(Math.min(c.a,d.a));out.push({from:d.id,to:c.id,amount:x});
c.a=r2(c.a-x);d.a=r2(d.a-x);if(c.a<0.01)cr.shift();if(d.a<0.01)db.shift()}
return out;
}

/* ============ 4. VIEWS (each function returns the HTML for one screen) ============ */
const h=(s)=>s;
// Home screen: greeting, totals and the 5 most recent expenses
function vHome(){
let spent=0,me=0,n=S.trips.length;
S.trips.forEach(t=>{const c=calc(t);spent+=c.total;me+=c.net[t.members[0].id]||0}); // members[0] is "you"
const recent=S.trips.flatMap(t=>t.expenses.map(e=>({...e,tn:t.name,tid:t.id}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
return`<section class="glass hero tilt"><div class="sub">Hey ${esc(S.profile.name)} 👋</div><h2 style="font-size:26px;margin:4px 0">Split trips, <span class="grad">not friendships.</span></h2>
<div class="sub">Add expenses, see who owes whom, and settle in the fewest payments.</div><div class="row mt wr"><button data-a="newTrip">＋ Start a trip</button>${n?`<button class="gh" data-a="nav" data-v="trips">View trips</button>`:''}</div></section>
<div class="grid stats"><div class="glass tilt stat"><span class="sub">Trips</span><b>${n}</b></div><div class="glass tilt stat"><span class="sub">Total spent</span><b>${fmt(spent)}</b></div>
<div class="glass tilt stat"><span class="sub">Your balance</span><b class="${me>=0?'pos':'neg'}">${me>=0?'▲':'▼'} ${fmt(me)}</b><span class="sub">${me>=0?'you get back':'you owe'}</span></div></div>
<h2>Recent expenses</h2><div class="glass">${recent.length?recent.map(e=>`<div class="item row sp"><div class="row"><span style="font-size:22px">${CATS[e.cat][0]}</span><div><b>${esc(e.title)}</b><div class="sub">${esc(e.tn)} · ${e.date}</div></div></div><b>${fmt(e.amount)}</b></div>`).join(''):'<div class="empty">No expenses yet. Create a trip to begin.</div>'}</div>`;
}
// Trips tab: list of trip cards (or an empty state)
function vTrips(){
if(!S.trips.length)return`<div class="glass empty">🧳<br>No trips yet.<div class="mt"><button data-a="newTrip">Create your first trip</button></div></div>`;
return`<h2>Your trips</h2><div class="grid">${S.trips.map(t=>{const c=calc(t),p=suggest(c.net).length;return`<div class="glass tilt" style="cursor:pointer" data-a="open" data-id="${t.id}" role="button" tabindex="0">
<div style="font-size:34px">${esc(t.emoji)}</div><h3>${esc(t.name)}</h3><div class="sub">${t.members.length} members · ${t.expenses.length} expenses</div>
<div class="row sp mt"><b>${fmt(c.total)}</b><span class="pill">${p?p+' pending payment'+(p>1?'s':''):'✔ All settled'}</span></div></div>`}).join('')}</div>`;
}
// One open trip, with four sub-tabs: Expenses, Balances, Settle, Summary
function vTrip(t){
const subs=[['expenses','🧾 Expenses'],['balances','⚖️ Balances'],['settle','🤝 Settle'],['summary','📊 Summary']];
const c=calc(t);
let body='';
if(UI.sub==='expenses'){
// Expenses sub-tab: search box + list filtered by title or category name
const q=UI.q.toLowerCase(),list=t.expenses.filter(e=>!q||e.title.toLowerCase().includes(q)||CATS[e.cat][1].toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
body=`<div class="row"><input id="q" placeholder="Search expenses or category…" value="${esc(UI.q)}" aria-label="Search expenses"><button data-a="newExp">＋ Add</button></div><div class="glass mt">${list.length?list.map(e=>`<div class="item"><div class="row sp"><div class="row"><span style="font-size:24px">${CATS[e.cat][0]}</span><div><b>${esc(e.title)}</b><div class="sub">${esc(mem(t,e.payer).name)} paid · ${e.date} · ${Object.keys(e.shares).length} people · ${e.mode}</div></div></div><b>${fmt(e.amount)}</b></div>
<div class="row mt wr"><button class="gh sm" data-a="editExp" data-id="${e.id}">✏️ Edit</button><button class="dg sm" data-a="delExp" data-id="${e.id}">🗑 Delete</button></div></div>`).join(''):'<div class="empty">No expenses found.</div>'}</div>`;
}else if(UI.sub==='balances'){
// Balances sub-tab: what each member paid, their share and whether they get or owe money
body=`<div class="glass">${t.members.map(m=>{const n=c.net[m.id];return`<div class="item row sp"><div class="row"><div class="av">${ini(m.name)}</div><div><b>${esc(m.name)}</b><div class="sub">Paid ${fmt(c.paid[m.id])} · Share ${fmt(c.owed[m.id])}</div></div></div>
<b class="${n>0.009?'pos':n<-0.009?'neg':''}">${n>0.009?'▲ gets '+fmt(n):n<-0.009?'▼ owes '+fmt(-n):'✔ settled'}</b></div>`}).join('')}</div>`;
}else if(UI.sub==='settle'){
// Settle sub-tab: suggested payments (with "Mark paid") and payment history
const s=suggest(c.net);
body=`<h3>Suggested payments <span class="pill">${s.length} transaction${s.length===1?'':'s'}</span></h3><div class="glass mt">${s.length?s.map(x=>`<div class="item row sp wr"><div><b>${esc(mem(t,x.from).name)}</b> → <b>${esc(mem(t,x.to).name)}</b><div class="sub">Pending</div></div><div class="row"><b>${fmt(x.amount)}</b><button class="sm" data-a="pay" data-f="${x.from}" data-to="${x.to}" data-amt="${x.amount}">Mark paid</button></div></div>`).join(''):'<div class="empty">🎉 Everyone is settled up!</div>'}</div>
<h3 class="mt" style="margin-top:18px">Settlement history</h3><div class="glass mt">${t.settlements.length?t.settlements.slice().reverse().map(x=>`<div class="item row sp"><div>✔ <b>${esc(mem(t,x.from).name)}</b> paid <b>${esc(mem(t,x.to).name)}</b><div class="sub">${new Date(x.t).toLocaleString()}</div></div><div class="row"><b>${fmt(x.amount)}</b><button class="gh sm" data-a="undo" data-id="${x.id}" aria-label="Undo payment">↩</button></div></div>`).join(''):'<div class="empty">No payments recorded yet.</div>'}</div>`;
}else{
// Summary sub-tab: totals and spending by category
const by={};t.expenses.forEach(e=>by[e.cat]=(by[e.cat]||0)+e.amount);
const top=Object.entries(c.paid).sort((a,b)=>b[1]-a[1])[0];
body=`<div class="grid stats"><div class="glass stat"><span class="sub">Total</span><b>${fmt(c.total)}</b></div><div class="glass stat"><span class="sub">Per person</span><b>${fmt(r2(c.total/t.members.length))}</b></div><div class="glass stat"><span class="sub">Top payer</span><b style="font-size:18px">${top&&top[1]>0?esc(mem(t,top[0]).name):'—'}</b></div></div>
<div class="glass"><h3>By category</h3>${Object.keys(by).length?Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="mt"><div class="row sp"><span>${CATS[k][0]} ${CATS[k][1]}</span><span>${fmt(v)} · ${Math.round(v/c.total*100)}%</span></div><div class="bar"><i style="width:${v/c.total*100}%"></i></div></div>`).join(''):'<div class="empty">Add expenses to see insights.</div>'}</div>`;
}
// Trip header (back, add member, delete trip), title and the sub-tab buttons, then the body chosen above
return`<div class="row sp wr"><button class="gh sm" data-a="back">← Trips</button><div class="row wr"><button class="gh sm" data-a="addMember">＋ Member</button><button class="dg sm" data-a="delTrip">Delete trip</button></div></div>
<div class="row mt"><span style="font-size:38px">${esc(t.emoji)}</span><div><h2 style="margin:0">${esc(t.name)}</h2><div class="sub">${t.members.map(m=>esc(m.name)).join(', ')}</div></div></div>
<div class="seg mt" role="tablist" style="margin-bottom:14px">${subs.map(([k,l])=>`<button role="tab" class="${UI.sub===k?'on':''}" aria-selected="${UI.sub===k}" data-a="sub" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
}
// Alerts tab: notifications list
function vAlerts(){return`<div class="row sp"><h2>Notifications</h2>${S.notifs.length?'<button class="gh sm" data-a="clearN">Clear all</button>':''}</div><div class="glass">${S.notifs.length?S.notifs.map(n=>`<div class="item">🔔 ${esc(n.msg)}<div class="sub">${new Date(n.t).toLocaleString()}</div></div>`).join(''):'<div class="empty">You’re all caught up.</div>'}</div>`}
// Profile tab: name, calm mode, save, export and reset
function vProfile(){return`<h2>Profile</h2><div class="glass"><div class="row"><div class="av">${ini(S.profile.name)}</div><div class="grow"><label class="f" style="margin:0">Your name (first member of new trips)<input id="pname" value="${esc(S.profile.name)}"></label></div></div>
<label class="f row"><input type="checkbox" id="calm" style="width:auto" ${S.profile.calm?'checked':''}> Calm mode (turn off animations, tilt & confetti)</label>
<div class="row wr mt"><button data-a="saveProfile">Save</button><button class="gh" data-a="export">⬇ Export data</button><button class="dg" data-a="reset">Reset all data</button></div>
<p class="sub mt">Data is stored only in this browser (localStorage). Cloud sync, sign-in and push notifications can plug into the data layer later.</p></div>`}

// render: redraws the current screen and the bottom navigation bar
function render(){
document.body.classList.toggle('calm',!!S.profile.calm);
const t=UI.trip&&trip(UI.trip);if(UI.trip&&!t)UI.trip=null;
$app.innerHTML=UI.tab==='home'?vHome():UI.tab==='trips'?(t?vTrip(t):vTrips()):UI.tab==='alerts'?vAlerts():vProfile();
const tabs=[['home','🏠','Home'],['trips','🧳','Trips'],['alerts','🔔','Alerts'],['profile','👤','Profile']];
$nav.innerHTML=tabs.map(([k,i,l])=>`<button class="${UI.tab===k?'on':''}" data-a="nav" data-v="${k}" aria-label="${l}"><span>${i}</span>${l}${k==='alerts'&&S.notifs.length?`<i class="dot">${S.notifs.length}</i>`:''}</button>`).join('');
}
// The three page elements the script draws into (they exist in index.html)
const $app=document.getElementById('app'),$nav=document.getElementById('nav'),$layer=document.getElementById('layer');

/* ============ 5. MODALS & FORMS ============ */
// modal: shows a pop-up with the given HTML and focuses the first field
function modal(html){$layer.innerHTML=`<div class="modal" data-a="closeBg"><div class="glass" role="dialog" aria-modal="true">${html}</div></div>`;const f=$layer.querySelector('input,select');f&&f.focus()}
const close=()=>$layer.innerHTML='';
// "New trip" form
function tripForm(){modal(`<h2>New trip</h2><form id="fTrip"><label class="f">Trip name<input name="name" required maxlength="40" placeholder="Manali Road Trip"></label>
<label class="f">Emoji<input name="emoji" maxlength="4" value="🏔️"></label><label class="f">Friends (comma separated; you are added automatically)<textarea name="friends" rows="2" placeholder="Aarav, Riya, Kabir"></textarea></label>
<div class="row mt"><button>Create trip</button><button type="button" class="gh" data-a="close">Cancel</button></div></form>`)}
// "Add member" form
function memberForm(){modal(`<h2>Add member</h2><form id="fMem"><label class="f">Name<input name="name" required maxlength="30"></label><p class="sub">New members only share expenses you add afterwards.</p><div class="row mt"><button>Add</button><button type="button" class="gh" data-a="close">Cancel</button></div></form>`)}
// Add / edit expense form (e is the expense being edited; empty when adding)
function expForm(e){
const t=trip(UI.trip),ed=e||{title:'',amount:'',cat:'food',payer:t.members[0].id,date:today(),mode:'equal',raw:{},shares:eq(1,t.members.map(m=>m.id))};
if(!e)ed.shares=Object.fromEntries(t.members.map(m=>[m.id,0]));
modal(`<h2>${e?'Edit':'Add'} expense</h2><form id="fExp" data-id="${e?e.id:''}"><label class="f">What was it for?<input name="title" required maxlength="50" value="${esc(ed.title)}" placeholder="Dinner at the beach"></label>
<div class="row"><label class="f grow">Amount (₹)<input name="amount" type="number" step="0.01" min="0.01" required value="${ed.amount}"></label><label class="f grow">Date<input name="date" type="date" required value="${ed.date}"></label></div>
<div class="row"><label class="f grow">Category<select name="cat">${Object.entries(CATS).map(([k,v])=>`<option value="${k}" ${ed.cat===k?'selected':''}>${v[0]} ${v[1]}</option>`).join('')}</select></label>
<label class="f grow">Paid by<select name="payer">${t.members.map(m=>`<option value="${m.id}" ${ed.payer===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label></div>
<label class="f">Split<select name="mode" id="mode"><option value="equal">Equally</option><option value="amount">Custom amounts</option><option value="percent">Percentages</option></select></label>
<div class="mt" id="parts">${t.members.map(m=>{const on=e?ed.shares[m.id]!==undefined:true,v=ed.raw[m.id]??'';return`<label class="row item" style="padding:8px 0"><input type="checkbox" name="p" value="${m.id}" style="width:auto" ${on?'checked':''}><span class="grow">${esc(m.name)}</span><input type="number" step="0.01" min="0" class="sv" data-id="${m.id}" value="${v}" style="width:110px;display:none" aria-label="Value for ${esc(m.name)}"></label>`}).join('')}</div>
<div class="sub" id="hint"></div><div class="row mt"><button>${e?'Save changes':'Add expense'}</button><button type="button" class="gh" data-a="close">Cancel</button></div></form>`);
$layer.querySelector('#mode').value=ed.mode;syncSplit();
}
// syncSplit: updates the expense form live (shows/hides amount boxes and the "x left" hint)
function syncSplit(){
const f=$layer.querySelector('#fExp');if(!f)return;const mode=f.mode.value;
f.querySelectorAll('.sv').forEach(i=>{i.style.display=mode==='equal'?'none':'block';i.placeholder=mode==='percent'?'%':'₹'});
const amt=parseFloat(f.amount.value)||0,ids=[...f.querySelectorAll('[name=p]:checked')].map(x=>x.value);
let s=0;f.querySelectorAll('.sv').forEach(i=>{if(ids.includes(i.dataset.id))s+=parseFloat(i.value)||0});
$layer.querySelector('#hint').textContent=mode==='equal'?(ids.length?`${fmt(r2(amt/ids.length))} each across ${ids.length} people`:'Select at least one person'):mode==='amount'?`Entered ${fmt(r2(s))} of ${fmt(amt)} (${fmt(r2(amt-s))} left)`:`Entered ${r2(s)}% of 100% (${r2(100-s)}% left)`;
}

/* ============ 6. ACTIONS, EVENTS, CONFETTI AND START-UP ============ */
// A = actions. Any element with data-a="name" runs A.name when clicked (see the click listener below)
const A={
nav:d=>{UI.tab=d.v;if(d.v!=='trips')UI.trip=null;render();scrollTo(0,0)},
newTrip:()=>tripForm(),close,closeBg:(d,e)=>{if(e.target.classList.contains('modal'))close()},
open:d=>{UI.tab='trips';UI.trip=d.id;UI.sub='expenses';UI.q='';render();scrollTo(0,0)},
back:()=>{UI.trip=null;render()},
sub:d=>{UI.sub=d.v;render()},
addMember:()=>memberForm(),
newExp:()=>expForm(),
editExp:d=>expForm(trip(UI.trip).expenses.find(e=>e.id===d.id)),
delExp:d=>{if(!confirm('Delete this expense?'))return;const t=trip(UI.trip);t.expenses=t.expenses.filter(e=>e.id!==d.id);notify(`Expense deleted in ${t.name}`);save();render();toast('Expense deleted')},
delTrip:()=>{const t=trip(UI.trip);if(!confirm(`Delete "${t.name}" and all its expenses?`))return;S.trips=S.trips.filter(x=>x.id!==t.id);UI.trip=null;save();render();toast('Trip deleted')},
// pay: record a settlement payment; confetti when everyone is settled
pay:d=>{const t=trip(UI.trip),amt=parseFloat(d.amt);t.settlements.push({id:uid(),from:d.f,to:d.to,amount:amt,t:Date.now()});
notify(`${mem(t,d.f).name} paid ${mem(t,d.to).name} ${fmt(amt)} (${t.name})`);save();render();toast('Payment recorded ✔');if(!suggest(calc(t).net).length)confetti()},
undo:d=>{const t=trip(UI.trip);t.settlements=t.settlements.filter(s=>s.id!==d.id);save();render()},
clearN:()=>{S.notifs=[];save();render()},
saveProfile:()=>{S.profile.name=document.getElementById('pname').value.trim()||'You';S.profile.calm=document.getElementById('calm').checked;save();render();toast('Profile saved')},
// export: downloads all data as tripsplit-data.json
export:()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download='tripsplit-data.json';a.click();URL.revokeObjectURL(a.href)},
reset:()=>{if(!confirm('Erase ALL trips and data from this browser?'))return;localStorage.removeItem(KEY);S=seed();UI={tab:'home',trip:null,sub:'expenses',q:''};save();render()}
};

// One click listener for the whole page: finds the nearest [data-a] element and runs its action
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b&&A[b.dataset.a])A[b.dataset.a](b.dataset,e)});
// Keyboard: Escape closes pop-ups; Enter/Space activates card "buttons" (role=button)
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button][data-a]')){e.preventDefault();e.target.click()}});
// Typing: live search in the expenses list, and live hint inside the expense form
document.addEventListener('input',e=>{
if(e.target.id==='q'){UI.q=e.target.value;const p=e.target.selectionStart;render();const q=document.getElementById('q');q.focus();q.setSelectionRange(p,p)}
else if(e.target.closest('#fExp'))syncSplit()});

// Form submissions: new trip, new member, add/edit expense
document.addEventListener('submit',e=>{
e.preventDefault();const f=e.target,fd=new FormData(f);
if(f.id==='fTrip'){
// Member names = your profile name + friends; duplicate names (ignoring case) are removed
const names=[S.profile.name,...String(fd.get('friends')).split(',').map(s=>s.trim()).filter(Boolean)];
const seen=new Set(),members=names.filter(n=>{const k=n.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).map(name=>({id:uid(),name}));
const t={id:uid(),name:fd.get('name').trim(),emoji:fd.get('emoji').trim()||'✈️',members,expenses:[],settlements:[]};
S.trips.unshift(t);notify(`Trip "${t.name}" created with ${members.length} members`);save();close();A.open({id:t.id});toast('Trip created 🎉');
}else if(f.id==='fMem'){
const t=trip(UI.trip),n=fd.get('name').trim();if(t.members.some(m=>m.name.toLowerCase()===n.toLowerCase()))return toast('That name already exists');
t.members.push({id:uid(),name:n});notify(`${n} joined ${t.name}`);save();close();render();
}else if(f.id==='fExp'){
const t=trip(UI.trip),amount=r2(parseFloat(fd.get('amount'))),mode=fd.get('mode'),ids=fd.getAll('p');
if(!(amount>0))return toast('Enter a valid amount');if(!ids.length)return toast('Select who participated');
// raw = the numbers typed for each selected person (amounts or percentages)
const raw={};f.querySelectorAll('.sv').forEach(i=>{if(ids.includes(i.dataset.id))raw[i.dataset.id]=parseFloat(i.value)||0});
let shares;
if(mode==='equal')shares=eq(amount,ids);
else if(mode==='amount'){const s=r2(Object.values(raw).reduce((a,b)=>a+b,0));if(Math.abs(s-amount)>0.01)return toast(`Amounts add to ${fmt(s)} but total is ${fmt(amount)}`);shares=raw}
else{const s=r2(Object.values(raw).reduce((a,b)=>a+b,0));if(Math.abs(s-100)>0.01)return toast(`Percentages add to ${s}%, need 100%`);
// last person gets the remainder so shares add up exactly to the amount
shares={};let acc=0;ids.forEach((id,i)=>{shares[id]=i===ids.length-1?r2(amount-acc):r2(amount*raw[id]/100);acc=r2(acc+shares[id])})}
const ex={id:f.dataset.id||uid(),title:fd.get('title').trim(),amount,cat:fd.get('cat'),payer:fd.get('payer'),date:fd.get('date'),mode,raw:mode==='equal'?{}:raw,shares};
if(f.dataset.id){t.expenses=t.expenses.map(x=>x.id===ex.id?ex:x)}else t.expenses.push(ex);
notify(`${mem(t,ex.payer).name} ${f.dataset.id?'updated':'added'} "${ex.title}" ${fmt(amount)} in ${t.name}`);save();close();render();toast('Expense saved ✔');
}
});

// Subtle 3D tilt of cards that follow the mouse (off in calm mode, reduced motion and on touch screens)
document.addEventListener('pointermove',e=>{
if(S.profile.calm||matchMedia('(prefers-reduced-motion:reduce)').matches||e.pointerType==='touch')return;
const c=e.target.closest&&e.target.closest('.tilt');document.querySelectorAll('.tilt').forEach(x=>{if(x!==c)x.style.transform=''});
if(!c)return;const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
c.style.transform=`perspective(700px) rotateX(${(-y*7).toFixed(2)}deg) rotateY(${(x*7).toFixed(2)}deg)`;
});

// Confetti: 120 coloured pieces drawn on the #cf canvas for about 2 seconds
function confetti(){
if(S.profile.calm||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
const cv=document.getElementById('cf'),x=cv.getContext('2d');cv.width=innerWidth;cv.height=innerHeight;
const cols=['#8b5cf6','#3b82f6','#22d3ee','#f472b6','#fff'];
const ps=Array.from({length:120},()=>({x:innerWidth/2,y:innerHeight/2,vx:(Math.random()-.5)*14,vy:Math.random()*-14-2,s:Math.random()*7+3,c:cols[Math.floor(Math.random()*5)],r:Math.random()*6}));
let n=0;(function f(){x.clearRect(0,0,cv.width,cv.height);ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.35;p.r+=.2;x.fillStyle=p.c;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillRect(0,0,p.s,p.s*.6);x.restore()});if(++n<110)requestAnimationFrame(f);else x.clearRect(0,0,cv.width,cv.height)})();
}

// Start-up: draw the first screen
render();
