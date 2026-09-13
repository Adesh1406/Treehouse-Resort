import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const ACC_KEY="ww_acc_v2", SES_KEY="ww_ses_v2", LOG_KEY="ww_log_v2";
function getAccounts(){try{return JSON.parse(localStorage.getItem(ACC_KEY)||"{}")}catch{return{}}}
function saveAccounts(a){localStorage.setItem(ACC_KEY,JSON.stringify(a))}
function getSession(){try{return JSON.parse(localStorage.getItem(SES_KEY)||"null")}catch{return null}}
function setSession(s){s?localStorage.setItem(SES_KEY,JSON.stringify(s)):localStorage.removeItem(SES_KEY)}
function getSightings(){try{return JSON.parse(localStorage.getItem(LOG_KEY)||"[]")}catch{return[]}}
function saveSightings(l){localStorage.setItem(LOG_KEY,JSON.stringify(l.slice(-50)))}
function hash(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0}return"h"+Math.abs(h)}

function updateUserUI(){
  const s=getSession(),chip=document.getElementById("userChip"),btn=document.getElementById("authOpenBtn");
  if(s){chip.classList.add("show");document.getElementById("userName").textContent=s.name.split(" ")[0];document.getElementById("userAvatar").textContent=(s.name[0]||"U").toUpperCase();btn.textContent="Sign out";btn.onclick=()=>{setSession(null);updateUserUI();showToast("Signed out")}}
  else{chip.classList.remove("show");btn.textContent="Sign in";btn.onclick=()=>openAuth()}
  renderLog();
}

/* ===== ADD-ON LOGIC: PROFILE + BOOKING MANAGEMENT ===== */
function getBookings(){
  const s=getSession(); if(!s)return [];
  try{return JSON.parse(localStorage.getItem("ww_book_"+s.email)||"[]")}catch{return[]}
}
function saveBookings(list){
  const s=getSession(); if(s)localStorage.setItem("ww_book_"+s.email,JSON.stringify(list));
}
function renderProfile(){
  const s=getSession(), list=getBookings();
  const avatar=document.getElementById("profileAvatar");
  if(!s){
    document.getElementById("profileName").textContent="Guest";
    document.getElementById("profileEmail").textContent="Sign in to manage your stays";
    avatar.textContent="G"; document.getElementById("profileBookingCount").textContent="0";
    document.getElementById("profileSightCount").textContent=getSightings().length;
    document.getElementById("profileBookingList").innerHTML='<div class="profile-empty">Sign in to access saved reservations, booking status and stay management.</div>';
    document.getElementById("profileSignOut").style.display="none"; return;
  }
  document.getElementById("profileSignOut").style.display="block";
  avatar.textContent=(s.name[0]||"U").toUpperCase();
  document.getElementById("profileName").textContent=s.name;
  document.getElementById("profileEmail").textContent=s.email;
  document.getElementById("profileBookingCount").textContent=list.length;
  document.getElementById("profileSightCount").textContent=getSightings().length;
  const el=document.getElementById("profileBookingList");
  if(!list.length){el.innerHTML='<div class="profile-empty">No saved stays yet. Your reservations will appear here.</div>';return}
  el.innerHTML=list.slice().reverse().map((b,i)=>{
    const originalIndex=list.length-1-i;
    const status=b.status||"Confirmed";
    return `<div class="booking-item"><div class="booking-top"><span class="booking-tree">${b.treehouse||"Any"}</span><span class="booking-status">${status}</span></div><div class="booking-meta">${b.checkIn||"—"} → ${b.checkOut||"—"} · ${b.guests||"2 Guests"}<br><small>${b.id||"WW-"+String(b.at||Date.now()).slice(-6)}</small></div><div class="booking-controls"><button onclick="editBooking(${originalIndex})"><i class="fa-solid fa-pen"></i> Edit</button><button onclick="cancelBooking(${originalIndex})"><i class="fa-solid fa-xmark"></i> Cancel</button></div></div>`;
  }).join("");
}
let editingBookingIndex=null;
window.editBooking=function(i){
  const list=getBookings();const b=list[i];if(!b)return; editingBookingIndex=i;
  closeProfile();document.querySelector("#bookingForm .book-submit").innerHTML='Save changes <i class="fa-solid fa-check"></i>';document.getElementById("checkIn").value=b.checkIn||"";document.getElementById("checkOut").value=b.checkOut||"";
  document.getElementById("guests").value=b.guests||"2 Guests";document.getElementById("treehouse").value=b.treehouse||"Any";
  document.getElementById("booking").scrollIntoView({behavior:"smooth"});showToast("Edit your stay, then check availability");
};
window.cancelBooking=function(i){
  const list=getBookings();if(!list[i])return;
  list[i].status="Cancelled";saveBookings(list);renderProfile();showToast("Booking cancelled");
};
function openProfile(){renderProfile();document.getElementById("profileOverlay").classList.add("open");document.getElementById("profileDrawer").classList.add("open")}
function closeProfile(){document.getElementById("profileOverlay").classList.remove("open");document.getElementById("profileDrawer").classList.remove("open")}
document.getElementById("userChip").onclick=()=>{if(getSession())openProfile();else openAuth()};
document.getElementById("profileClose").onclick=closeProfile;document.getElementById("profileOverlay").onclick=closeProfile;
document.getElementById("profileReserveBtn").onclick=()=>{closeProfile();document.getElementById("booking").scrollIntoView({behavior:"smooth"})};
document.getElementById("manageBookingsBtn").onclick=()=>document.getElementById("bookingManager").scrollIntoView({behavior:"smooth"});
document.getElementById("profileSignOut").onclick=()=>{setSession(null);updateUserUI();renderProfile();closeProfile();showToast("Signed out")};

/* Keep profile data synced whenever the existing UI updates. */
const _updateUserUI=updateUserUI;
updateUserUI=function(){_updateUserUI();renderProfile()};

/* ===== ADD-ON: REALISTIC WILDLIFE RIG =====
   Only animals with reliable, properly animated GLB assets are used.
   The old cumulative bone rotations were removed because they caused jittery / cheap-looking motion. */
const anatomyData={
 "FOX":["Red fox · lean quadruped","Walk · run · idle · alert","Skull · muzzle · ears · neck · ribcage · pelvis · four limbs · paws · tail","Independent bone micro-motion, breathing, weight transfer and foot-contact timing"],
 "HORSE":["Horse · large athletic quadruped","Walk · trot · idle","Head · jaw · neck · shoulder · ribcage · pelvis · four legs · hooves · tail","Stride-based weight transfer, neck balance, breathing and tail movement"],
 "FLAMINGO":["Flamingo · long-legged wading bird","Walk · glide · wingbeat · idle","Head · beak · long neck · torso · wings · legs · feet","Wingbeat timing, neck balance, leg articulation and subtle body motion"],
 "PARROT":["Parrot · compact flying bird","Flight · wingbeat · glide","Head · beak · neck · torso · wings · legs · feet","Wing-driven flight, body stabilization and natural head motion"],
 "STORK":["Stork · long-legged flying bird","Flight · glide · wingbeat","Head · beak · neck · torso · wings · long legs · feet","Wingbeat timing, neck stabilization and realistic glide posture"],
};
function showAnimalDetail(name){
 const d=anatomyData[name]||["Wild animal","Natural animation","Head · torso · limbs","Real-time lighting + motion"];
 document.getElementById("animalDetailName").textContent=name;
 ["animalBody","animalMovement","animalStructure","animalDetailText"].forEach((id,i)=>document.getElementById(id).textContent=d[i]);
 document.getElementById("animalDetail").classList.add("show");
}
document.getElementById("animalDetailClose").onclick=()=>document.getElementById("animalDetail").classList.remove("show");
const _showNotice=showNotice;
showNotice=function(t){_showNotice(t);const name=t.replace(" approaches from the west","").replace(" approaches from the east","");if(anatomyData[name])showAnimalDetail(name)};

function addNaturalRig(model,kind){
 const bones=[];
 model.traverse(o=>{
   if(o.isBone){
     bones.push(o);
     o.userData.restRot={x:o.rotation.x,y:o.rotation.y,z:o.rotation.z};
   }
 });
 model.userData.naturalRig={bones,phase:Math.random()*Math.PI*2,kind};
}
function updateNaturalRig(model,time){
 const rig=model?.userData?.naturalRig;if(!rig)return;
 const t=time*.001+rig.phase;
 rig.bones.forEach(b=>{
   const n=(b.name||"").toLowerCase(), r=b.userData.restRot||{x:0,y:0,z:0};
   let x=r.x,y=r.y,z=r.z;
   if(/head|neck/.test(n)) z+=Math.sin(t*1.05)*.012;
   if(/spine|chest|body|torso/.test(n)) x+=Math.sin(t*.9)*.006;
   if(/tail/.test(n)) y+=Math.sin(t*1.55)*.035;
   if(/ear/.test(n)) z+=Math.sin(t*1.7)*.018;
   if(/wing/.test(n)&&rig.kind==="air") z+=Math.sin(t*2.25)*.018;
   b.rotation.set(x,y,z);
 });
}

const authOverlay=document.getElementById("authOverlay");
function openAuth(){authOverlay.classList.add("open");document.getElementById("authMsg").textContent=""}
function closeAuth(){authOverlay.classList.remove("open")}
document.getElementById("authClose").onclick=closeAuth;
document.getElementById("authOpenBtn").onclick=openAuth;
document.getElementById("navReserve").onclick=()=>document.getElementById("booking").scrollIntoView({behavior:"smooth"});
document.querySelectorAll(".auth-tab").forEach(tab=>{
  tab.onclick=()=>{document.querySelectorAll(".auth-tab").forEach(t=>t.classList.remove("active"));tab.classList.add("active");
    const login=tab.dataset.tab==="login";
    document.getElementById("loginForm").style.display=login?"block":"none";
    document.getElementById("registerForm").style.display=login?"none":"block";
    document.getElementById("authMsg").textContent=""};
});
document.getElementById("registerForm").onsubmit=e=>{
  e.preventDefault();
  const name=document.getElementById("regName").value.trim(),email=document.getElementById("regEmail").value.trim().toLowerCase(),pass=document.getElementById("regPass").value;
  const acc=getAccounts();if(acc[email]){document.getElementById("authMsg").textContent="Account exists.";return}
  acc[email]={name,email,pass:hash(pass)};saveAccounts(acc);setSession({name,email});updateUserUI();closeAuth();showToast("Welcome, "+name.split(" ")[0]);
};
document.getElementById("loginForm").onsubmit=e=>{
  e.preventDefault();
  const email=document.getElementById("loginEmail").value.trim().toLowerCase(),pass=document.getElementById("loginPass").value,acc=getAccounts()[email];
  if(!acc||acc.pass!==hash(pass)){document.getElementById("authMsg").textContent="Invalid credentials.";return}
  setSession({name:acc.name,email});updateUserUI();closeAuth();showToast("Welcome back, "+acc.name.split(" ")[0]);
};

let pct=0;const lt=setInterval(()=>{pct=Math.min(100,pct+(pct<70?5:2));document.getElementById("loaderBar").style.width=pct+"%";document.getElementById("loaderPct").textContent=`Preparing the forest… ${pct}%`;
  if(pct>=100){clearInterval(lt);setTimeout(()=>{document.getElementById("loader").classList.add("hide");document.body.classList.remove("locked");document.getElementById("wildlifeCounter").classList.add("show");createStars();setTimeout(()=>summonRandomAnimal(),800)},350)}},70);

const nav=document.getElementById("nav");
window.addEventListener("scroll",()=>nav.classList.toggle("scrolled",scrollY>50));
document.getElementById("menuBtn").onclick=()=>document.getElementById("navlinks").classList.toggle("open");
document.querySelectorAll("#navlinks a").forEach(a=>a.onclick=()=>document.getElementById("navlinks").classList.remove("open"));
const cursor=document.getElementById("cursor"),ring=document.getElementById("cursorRing");
window.addEventListener("mousemove",e=>{cursor.style.left=e.clientX+"px";cursor.style.top=e.clientY+"px";setTimeout(()=>{ring.style.left=e.clientX+"px";ring.style.top=e.clientY+"px"},30)});
document.querySelectorAll("a,button,.room-card,.g-card,.exp-card").forEach(el=>{el.addEventListener("mouseenter",()=>ring.classList.add("big"));el.addEventListener("mouseleave",()=>ring.classList.remove("big"))});
/* Mouse giggle: tiny playful burst on movement + ripple on click, without changing navigation or layout. */
let lastGiggle=0;
window.addEventListener("mousemove",e=>{
  const now=performance.now(); if(now-lastGiggle<75)return; lastGiggle=now;
  const j=document.createElement("span");j.className="cursor-jiggle";j.style.left=e.clientX+"px";j.style.top=e.clientY+"px";document.body.appendChild(j);setTimeout(()=>j.remove(),450);
});
window.addEventListener("click",e=>{
  const r=document.createElement("span");r.className="cursor-ripple";r.style.left=e.clientX+"px";r.style.top=e.clientY+"px";document.body.appendChild(r);setTimeout(()=>r.remove(),700);
});

const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add("visible")}),{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>io.observe(el));

/* ========== REALISTIC WILDLIFE ========== */
const canvas=document.getElementById("wildlifeCanvas");
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x07150d,.035);
const camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,100);
camera.position.set(0,1.55,10.5);
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;

const hemi=new THREE.HemisphereLight(0xeaf3e8,0x101b14,1.15);scene.add(hemi);
const key=new THREE.DirectionalLight(0xfff2dc,2.2);
key.position.set(-5,10,7);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.near=.5;key.shadow.camera.far=40;
key.shadow.camera.left=-12;key.shadow.camera.right=12;
key.shadow.camera.top=10;key.shadow.camera.bottom=-10;
key.shadow.bias=-.0002;key.shadow.normalBias=.015;scene.add(key);
const fill=new THREE.DirectionalLight(0xbdd5c1,.55);fill.position.set(6,5,-4);scene.add(fill);
const rim=new THREE.DirectionalLight(0xe5edff,.35);rim.position.set(-3,6,-8);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(50,24),new THREE.ShadowMaterial({opacity:.34}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;scene.add(ground);

/* Removed low-quality/unreliable assets (deer, bear, wolves, owls, etc.).
   These five use known animated GLBs so their anatomy and locomotion remain coherent. */
const animals=[
 {name:"FOX",file:"https://threejs.org/examples/models/gltf/Fox.glb",scale:.038,kind:"ground",y:-.02,speed:.62,pause:4.2,weight:5},
 {name:"HORSE",file:"https://threejs.org/examples/models/gltf/Horse.glb",scale:.019,kind:"ground",y:-.02,speed:.46,pause:4.8,weight:4},
 {name:"FLAMINGO",file:"https://threejs.org/examples/models/gltf/Flamingo.glb",scale:.021,kind:"air",y:1.25,speed:.52,pause:3.2,weight:3},
 {name:"PARROT",file:"https://threejs.org/examples/models/gltf/Parrot.glb",scale:.020,kind:"air",y:1.75,speed:.68,pause:2.8,weight:3},
 {name:"STORK",file:"https://threejs.org/examples/models/gltf/Stork.glb",scale:.020,kind:"air",y:1.45,speed:.48,pause:3.5,weight:3}
];
function pickAnimal(){const t=animals.reduce((s,a)=>s+(a.weight||1),0);let r=Math.random()*t;for(const a of animals){r-=(a.weight||1);if(r<=0)return a}return animals[0]}
const loader=new GLTFLoader();
let animal=null,mixer=null,animalBusy=false,animalAction=null,safetyTimer=null;
let totalSpotted=getSightings().length;
document.getElementById("animalCount").textContent=totalSpotted;
const icons={"FOX":"fa-dog","HORSE":"fa-horse","FLAMINGO":"fa-dove","PARROT":"fa-dove","STORK":"fa-dove"};
function logSighting(name){const list=getSightings();list.push({name,time:Date.now()});saveSightings(list);totalSpotted=list.length;document.getElementById("animalCount").textContent=totalSpotted;renderLog();previewLastAnimal(name)}
function renderLog(){
 const list=getSightings().slice().reverse();const el=document.getElementById("logList");
 if(!list.length){el.innerHTML='<div class="log-empty">No sightings yet. Press the paw button or wait.</div>';return}
 el.innerHTML=list.map(s=>{const t=new Date(s.time);const when=t.toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});return `<div class="log-item"><div class="log-icon"><i class="fa-solid ${icons[s.name]||"fa-paw"}"></i></div><div><strong>${s.name}</strong><span>${when}</span></div></div>`}).join("")}

const logCanvas=document.getElementById("logCanvas");
const logScene=new THREE.Scene();
const logCam=new THREE.PerspectiveCamera(35,1,.1,40);logCam.position.set(0,1.1,3.8);
const logRen=new THREE.WebGLRenderer({canvas:logCanvas,alpha:true,antialias:true});
logRen.setPixelRatio(Math.min(devicePixelRatio,2));logRen.outputColorSpace=THREE.SRGBColorSpace;logRen.toneMapping=THREE.ACESFilmicToneMapping;logRen.toneMappingExposure=1.08;
logScene.add(new THREE.HemisphereLight(0xeaf3e8,0x101b14,1.25));
const ls=new THREE.DirectionalLight(0xfff1dc,2.0);ls.position.set(2.5,5,3.5);logScene.add(ls);
const logFill=new THREE.DirectionalLight(0xbfd8c5,.45);logFill.position.set(-3,2,-2);logScene.add(logFill);
let logModel=null,logMixer=null;
function sizeLog(){const b=logCanvas.parentElement.getBoundingClientRect();logRen.setSize(b.width,b.height);logCam.aspect=b.width/Math.max(b.height,1);logCam.updateProjectionMatrix()}
sizeLog();window.addEventListener("resize",sizeLog);
function prepareModel(model){
 model.traverse(o=>{
   if(o.isMesh){
     o.castShadow=true;o.receiveShadow=true;
     if(o.material){o.material.side=THREE.FrontSide;o.material.roughness=Math.min(o.material.roughness??.65,.78);o.material.needsUpdate=true}
   }
 });
}
function chooseClip(anims,kind){
 if(!anims?.length)return null;
 const preferred=kind==="ground"?[/walk/i,/run/i,/idle/i]:[/survey/i,/wing/i,/fly/i,/idle/i];
 for(const rx of preferred){const c=anims.find(a=>rx.test(a.name));if(c)return c}
 return anims[0];
}

/* ===== ADD-ON: FIVE LARGE DETAILED PROCEDURAL ANIMALS ===== */
function PMat(hex,rough=.78){return new THREE.MeshStandardMaterial({color:hex,roughness:rough,metalness:0});}
function PBody(name,scale,material){const m=new THREE.Mesh(new THREE.SphereGeometry(1,36,24),material);m.name=name;m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;return m;}
function PLeg(name,x,y,z,len,r,material){const g=new THREE.Group();g.name=name;g.position.set(x,y,z);const sh=new THREE.Mesh(new THREE.CylinderGeometry(r*1.08,r,len,16),material);sh.position.y=-len/2;sh.castShadow=true;sh.receiveShadow=true;g.add(sh);return g;}
function buildProceduralAnimal(name){
 const g=new THREE.Group();const r={parts:{},phase:Math.random()*Math.PI*2};g.userData.proceduralRig=r;
 const add=(o,k)=>{g.add(o);if(k)r.parts[k]=o;return o};
 const gray=PMat(0x77746e),gray2=PMat(0x68655f),tan=PMat(0xc39b5e),brown=PMat(0x6b432c),lion=PMat(0xb17a45),orange=PMat(0xd18b3f),white=PMat(0xe5dfd2),black=PMat(0x161616);
 if(name==='AFRICAN ELEPHANT'){
  const body=add(PBody('barrel',[2.1,1.5,1.18],gray),'body');body.position.y=1.75;
  const shoulder=add(PBody('shoulder',[1.25,1.25,1.02],gray),'neck');shoulder.position.set(1.45,1.95,0);
  const head=add(PBody('head',[.86,.9,.78],gray),'head');head.position.set(2.25,2.05,0);
  [-1,1].forEach((z,i)=>{const e=add(PBody('ear',[.72,1.0,.08],gray2),'ear'+i);e.position.set(2.05,2.1,z*.48);e.rotation.y=i?-.3:.3});
  const trunk=add(new THREE.Mesh(new THREE.CylinderGeometry(.22,.1,1.75,24),gray2),'trunk');trunk.position.set(2.9,1.45,0);trunk.rotation.z=-.22;
  [-.22,.22].forEach(z=>{const t=add(new THREE.Mesh(new THREE.ConeGeometry(.07,.65,16),white));t.position.set(2.75,1.7,z);t.rotation.z=-1.0});
  [[-1.25,-.55],[-1.25,.55],[1.0,-.55],[1.0,.55]].forEach((q,i)=>add(PLeg('leg'+i,q[0],1.0,q[1],1.65,.27,gray2),'leg'+i));
  const tail=add(new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,.9,14),gray2),'tail');tail.position.set(-2,1.7,0);tail.rotation.z=-.55;
 } else if(name==='GIRAFFE'){
  const body=add(PBody('body',[1.5,.95,.7],tan),'body');body.position.y=1.15;
  const neck=add(PBody('long_neck',[.42,2.45,.42],tan),'neck');neck.position.set(1.0,3.45,0);
  const head=add(PBody('head',[.58,.5,.42],tan),'head');head.position.set(1.08,5.85,0);
  [-.22,.22].forEach(z=>{const h=add(new THREE.CylinderGeometry(.045,.065,.4,12),null);h.position.set(.95,6.5,z);});
  [-.22,.22].forEach((z,i)=>{const e=add(PBody('ear',[.25,.15,.05],tan));e.position.set(.78,6.05,z);e.rotation.y=i?-.2:.2});
  const mane=add(new THREE.Mesh(new THREE.CylinderGeometry(.32,.18,2.1,16),brown),'mane');mane.position.set(.7,4.0,0);
  [[-.85,-.42],[-.85,.42],[.85,-.42],[.85,.42]].forEach((q,i)=>add(PLeg('leg'+i,q[0],.85,q[1],1.95,.13,tan),'leg'+i));
  const tail=add(new THREE.Mesh(new THREE.CylinderGeometry(.045,.07,1.2,12),tan),'tail');tail.position.set(-1.5,1.25,0);tail.rotation.z=-.5;
 } else {
  const base=name==='TIGER'?orange:name==='ZEBRA'?white:lion;
  const body=add(PBody('body',[1.55,.88,.7],base),'body');body.position.y=1.05;
  const neck=add(PBody('neck',[.6,.78,.55],base),'neck');neck.position.set(1.05,1.4,0);neck.rotation.z=-.22;
  const head=add(PBody('head',[.58,.5,.45],base),'head');head.position.set(1.55,1.58,0);
  [-.24,.24].forEach((z,i)=>{const e=add(PBody('ear',[.17,.22,.055],base),'ear'+i);e.position.set(1.4,1.98,z);});
  [[-.9,-.44],[-.9,.44],[.82,-.44],[.82,.44]].forEach((q,i)=>add(PLeg('leg'+i,q[0],.75,q[1],1.15,.15,base),'leg'+i));
  const tail=add(new THREE.Mesh(new THREE.CylinderGeometry(.055,.1,1.5,14),base),'tail');tail.position.set(-1.55,1.15,0);tail.rotation.z=-.72;
  if(name==='LION'){const mane=add(new THREE.Mesh(new THREE.TorusGeometry(.62,.17,14,36),brown),'mane');mane.rotation.y=Math.PI/2;mane.position.set(1.36,1.6,0)}
  if(name==='TIGER'||name==='ZEBRA')for(let i=-3;i<=3;i++){const stripe=add(new THREE.Mesh(new THREE.BoxGeometry(.055,.72,1.45),black));stripe.position.set(i*.31,1.0,0);stripe.rotation.y=i*.22;stripe.material.opacity=.7;stripe.material.transparent=true;}
 }
 g.scale.setScalar(name==='AFRICAN ELEPHANT'?1.18:name==='GIRAFFE'?1.0:1.08);return g;
}
function updateProceduralAnimal(g,time){const r=g?.userData?.proceduralRig;if(!r)return;const t=time*.001+r.phase,p=r.parts;if(p.body){p.body.rotation.z=Math.sin(t*1.1)*.018;p.body.position.y+=Math.sin(t*1.7)*.004}if(p.neck)p.neck.rotation.z=Math.sin(t*.85)*.035;if(p.head){p.head.rotation.y=Math.sin(t*.72)*.05;p.head.rotation.z=Math.sin(t*1.1)*.018}if(p.trunk)p.trunk.rotation.z=-.22+Math.sin(t*1.35)*.13;if(p.tail)p.tail.rotation.z+=Math.sin(t*1.5)*.02;Object.keys(p).filter(k=>k.startsWith('leg')).forEach((k,i)=>p[k].rotation.z=Math.sin(t*2.2+i*Math.PI)*.035);Object.keys(p).filter(k=>k.startsWith('ear')).forEach((k,i)=>p[k].rotation.z=Math.sin(t*1.8+i)*.045)}

function previewLastAnimal(name){
 document.getElementById("logPreviewLabel").textContent=name+" · recent sighting";
 const data=animals.find(a=>a.name===name)||animals[0];
 if(data.procedural){if(logModel)logScene.remove(logModel);logModel=buildProceduralAnimal(data.name);logModel.scale.setScalar((data.scale||1)*.78);logModel.position.set(0,data.y||0,0);logModel.rotation.y=.35;logScene.add(logModel);logMixer=null;return;}
 loader.load(data.file,gltf=>{
   if(logModel)logScene.remove(logModel);
   logModel=gltf.scene.clone(true);prepareModel(logModel);addNaturalRig(logModel,data.kind);
   logModel.scale.setScalar(data.scale*1.5);logModel.position.set(0,data.y||0,0);logModel.rotation.y=.35;logScene.add(logModel);logMixer=null;
   const clip=chooseClip(gltf.animations,data.kind);if(clip){logMixer=new THREE.AnimationMixer(logModel);logMixer.clipAction(clip).play()}
 },undefined,()=>{});
}
function easeInOut(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
function smooth(t){return t*t*(3-2*t)}
window.summonRandomAnimal=function(){
 if(animalBusy)return;animalBusy=true;
 const data=pickAnimal(),dir=Math.random()>.5?1:-1,depth=.7+Math.random()*1.5;
 if(data.procedural){if(animal)scene.remove(animal);animal=buildProceduralAnimal(data.name);animal.position.set(dir>0?-11:11,data.y||0,depth);animal.rotation.y=dir>0?Math.PI/2:-Math.PI/2;scene.add(animal);mixer=null;animalAction=null;document.getElementById("hudWildlife").textContent=data.name;showNotice(data.name+" approaches from the "+(dir>0?"west":"east"));logSighting(data.name);naturalPath(dir,data,dir>0?-11:11,data.y||0,depth);return;}
 loader.load(data.file,gltf=>{
   try{
     if(animal)scene.remove(animal);
     animal=gltf.scene;prepareModel(animal);addNaturalRig(animal,data.kind);
     const by=data.y??0,startX=dir>0?-11:11;
     animal.scale.setScalar(data.scale*.16);animal.position.set(startX,by+(data.kind==="air"?.25:0),depth);
     animal.rotation.y=dir>0?Math.PI/2:-Math.PI/2;scene.add(animal);
     mixer=null;animalAction=null;
     const clip=chooseClip(gltf.animations,data.kind);
     if(clip){mixer=new THREE.AnimationMixer(animal);animalAction=mixer.clipAction(clip);animalAction.setLoop(THREE.LoopRepeat);animalAction.setEffectiveTimeScale(data.speed||1);animalAction.play()}
     document.getElementById("hudWildlife").textContent=data.name;
     showNotice(data.name+" approaches from the "+(dir>0?"west":"east"));
     logSighting(data.name);naturalPath(dir,data,startX,by,depth);
   }catch(e){console.warn(e);animalBusy=false}
 },undefined,err=>{console.warn(err);animalBusy=false});
};
function naturalPath(dir,data,startX,baseY,depth){
 if(!animal)return;
 const approachMs=5200/Math.max(data.speed,.35),pauseMs=(data.pause||4)*1000,exitMs=4300/Math.max(data.speed,.35);
 const midX=(dir>0?-.2:.2)+(Math.random()-.5)*.45,tEnter=performance.now();
 function approach(now){
   if(!animal)return;const p=Math.min((now-tEnter)/approachMs,1),e=easeInOut(p);
   animal.position.x=startX+(midX-startX)*e;
   if(data.kind==="air"){
     animal.position.y=baseY+Math.sin(e*Math.PI)*.38;
     animal.position.z=depth+Math.sin(e*Math.PI)*.22;
   }else{
     animal.position.y=baseY;
     animal.position.z=depth+Math.sin(e*Math.PI)*.08;
   }
   const grow=smooth(Math.min(p/.28,1));animal.visible=grow>0;animal.traverse(o=>{if(o.isMesh&&o.material){o.material.opacity=1;o.material.transparent=false}});
   if(p<1)requestAnimationFrame(approach);else hold(performance.now());
 }
 function hold(t0){
   if(!animal)return;if(animalAction)animalAction.setEffectiveTimeScale(.16);
   function tick(now){
     if(!animal)return;const p=Math.min((now-t0)/pauseMs,1);
     if(data.kind==="air"){animal.position.y=baseY+Math.sin(now*.0008)*.045;animal.position.z=depth+Math.sin(now*.00065)*.05}
     if(p<1)requestAnimationFrame(tick);else leave(performance.now());
   }requestAnimationFrame(tick);
 }
 function leave(t0){
   if(!animal)return;if(animalAction)animalAction.setEffectiveTimeScale(data.speed||1);
   const sx=animal.position.x,ex=dir>0?12:-12;
   function tick(now){
     if(!animal)return;const p=Math.min((now-t0)/exitMs,1),e=easeInOut(p);
     animal.position.x=sx+(ex-sx)*e;
     if(data.kind==="air")animal.position.y=baseY+.2+Math.sin(e*Math.PI)*.3;else animal.position.y=baseY;
     if(p<1)requestAnimationFrame(tick);else{scene.remove(animal);animal=null;mixer=null;animalAction=null;animalBusy=false;document.getElementById("hudWildlife").textContent="Active";hideNotice()}
   }requestAnimationFrame(tick);
 }
 requestAnimationFrame(approach);clearTimeout(safetyTimer);safetyTimer=setTimeout(()=>{if(animalBusy){if(animal)scene.remove(animal);animal=null;mixer=null;animalAction=null;animalBusy=false}},approachMs+pauseMs+exitMs+4000);
}

const notice=document.getElementById("animalNotice");
function showNotice(t){notice.textContent=t;notice.classList.add("show");setTimeout(hideNotice,4500)}
function hideNotice(){notice.classList.remove("show")}
function wildlifeLoop(){setTimeout(()=>{summonRandomAnimal();wildlifeLoop()},12000+Math.random()*16000)}
wildlifeLoop();

const clock=new THREE.Clock();
(function animate(){requestAnimationFrame(animate);const d=clock.getDelta();if(mixer)mixer.update(d);if(logMixer)logMixer.update(d);if(animal){if(animal.userData.proceduralRig)updateProceduralAnimal(animal,performance.now());else updateNaturalRig(animal,performance.now());}if(logModel){if(logModel.userData.proceduralRig)updateProceduralAnimal(logModel,performance.now());else updateNaturalRig(logModel,performance.now());logModel.rotation.y+=.0028;} renderer.render(scene,camera);logRen.render(logScene,logCam)})();
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
let mx=0,my=0;window.addEventListener("mousemove",e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
setInterval(()=>{camera.position.x+=(mx*.18-camera.position.x)*.02;camera.position.y+=(1.55-my*.12-camera.position.y)*.02},16);

let isNight=false,rainOn=false;
function createStars(){const sky=document.getElementById("nightSky");sky.innerHTML="";for(let i=0;i<100;i++){const s=document.createElement("div");s.className="star";s.style.left=Math.random()*100+"%";s.style.top=Math.random()*100+"%";s.style.animationDelay=Math.random()*4+"s";s.style.width=s.style.height=(1+Math.random()*2)+"px";sky.appendChild(s)}}
document.getElementById("nightBtn").onclick=function(){
  isNight=!isNight;document.body.classList.toggle("night",isNight);
  this.querySelector("i").className=isNight?"fa-solid fa-sun":"fa-solid fa-moon";
  if(isNight){key.intensity=.85;hemi.intensity=.55;fill.intensity=.2;rim.intensity=.5;renderer.toneMappingExposure=.72}
  else{key.intensity=2.6;hemi.intensity=1.35;fill.intensity=.65;rim.intensity=.45;renderer.toneMappingExposure=1.12}
  showToast(isNight?"Night forest":"Day forest");
};
document.getElementById("rainBtn").onclick=function(){rainOn=!rainOn;this.classList.toggle("active",rainOn);showToast(rainOn?"Rain begins…":"Rain passes")};
document.getElementById("pawBtn").onclick=()=>summonRandomAnimal();
document.getElementById("topBtn").onclick=()=>scrollTo({top:0,behavior:"smooth"});

const fx=document.getElementById("fxCanvas"),ctx=fx.getContext("2d");
let fw,fh;function rsz(){fw=fx.width=innerWidth;fh=fx.height=innerHeight}rsz();window.addEventListener("resize",rsz);
const flies=Array.from({length:32},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:1+Math.random()*2,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.22,ph:Math.random()*6}));
const drops=Array.from({length:90},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,len:8+Math.random()*12,sp:4+Math.random()*5}));
(function draw(){ctx.clearRect(0,0,fw,fh);
  flies.forEach(f=>{f.x+=f.vx;f.y+=f.vy;f.ph+=.03;if(f.x<0||f.x>fw)f.vx*=-1;if(f.y<0||f.y>fh)f.vy*=-1;const a=.22+Math.sin(f.ph)*.38;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fillStyle=isNight?`rgba(160,190,255,${a})`:`rgba(220,240,160,${a})`;ctx.shadowColor=isNight?"#a0c0ff":"#e0f090";ctx.shadowBlur=9;ctx.fill();ctx.shadowBlur=0});
  if(rainOn){ctx.strokeStyle=isNight?"rgba(160,190,230,.28)":"rgba(180,210,180,.26)";ctx.lineWidth=1;drops.forEach(d=>{d.y+=d.sp;if(d.y>fh){d.y=-12;d.x=Math.random()*fw}ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-1,d.y+d.len);ctx.stroke()})}
  requestAnimationFrame(draw)})();

let audioCtx=null,noiseNode=null,soundOn=false;
document.getElementById("soundBtn").onclick=function(){
  if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  soundOn=!soundOn;this.classList.toggle("active",soundOn);
  if(soundOn){const buf=audioCtx.createBuffer(1,2*audioCtx.sampleRate,audioCtx.sampleRate);const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const src=audioCtx.createBufferSource();src.buffer=buf;src.loop=true;const f=audioCtx.createBiquadFilter();f.type="lowpass";f.frequency.value=360;const g=audioCtx.createGain();g.gain.value=.011;src.connect(f);f.connect(g);g.connect(audioCtx.destination);src.start();noiseNode=src;showToast("Forest ambience")}
  else{try{noiseNode?.stop()}catch{}noiseNode=null;showToast("Muted")}
};

window.openRoom=(n,p,g,b)=>{document.getElementById("modalTitle").textContent=n;document.getElementById("modalPrice").textContent=p;document.getElementById("modalGuests").textContent=g;document.getElementById("modalBed").textContent=b;document.getElementById("roomModal").classList.add("open")};
window.closeRoom=()=>document.getElementById("roomModal").classList.remove("open");
const reviews=[{t:'“It felt like the forest had built a room specifically for us.”',n:"— AARAV & MAYA"},{t:'“The most peaceful weekend we have ever experienced.”',n:"— RHEA & KABIR"},{t:'“Waking up above the trees changed our idea of luxury.”',n:"— PRIYA & ARJUN"},{t:'“Every detail felt designed around nature.”',n:"— NEHA & RAHUL"}];
let ri=0;function showRev(){document.getElementById("reviewText").textContent=reviews[ri].t;document.getElementById("reviewer").textContent=reviews[ri].n}
window.nextReview=()=>{ri=(ri+1)%reviews.length;showRev()};window.prevReview=()=>{ri=(ri-1+reviews.length)%reviews.length;showRev()};
document.getElementById("bookingForm").onsubmit=e=>{
  e.preventDefault();
  const s=getSession(),payload={id:"WW-"+Date.now().toString(36).toUpperCase(),checkIn:document.getElementById("checkIn").value,checkOut:document.getElementById("checkOut").value,guests:document.getElementById("guests").value,treehouse:document.getElementById("treehouse").value,status:"Confirmed",at:Date.now()};
  if(s){const k="ww_book_"+s.email;const prev=JSON.parse(localStorage.getItem(k)||"[]");if(editingBookingIndex!==null && prev[editingBookingIndex]){payload.id=prev[editingBookingIndex].id||payload.id;payload.status=prev[editingBookingIndex].status==="Cancelled"?"Confirmed":(prev[editingBookingIndex].status||"Confirmed");prev[editingBookingIndex]=payload;editingBookingIndex=null;document.querySelector("#bookingForm .book-submit").innerHTML='Check availability <i class="fa-solid fa-arrow-right"></i>';showToast("Booking updated ✦")}else{prev.push(payload);showToast("Saved to your account ✦")}localStorage.setItem(k,JSON.stringify(prev));renderProfile()}
  else showToast("Request received. Sign in to save.");
  setTimeout(()=>summonRandomAnimal(),500);
};
function showToast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
const gal=document.getElementById("galleryTrack");let dn=false,sx=0,ss=0;
gal.addEventListener("mousedown",e=>{dn=true;sx=e.pageX;ss=gal.scrollLeft});
window.addEventListener("mouseup",()=>dn=false);
gal.addEventListener("mousemove",e=>{if(!dn)return;e.preventDefault();gal.scrollLeft=ss-(e.pageX-sx)*1.4});
setInterval(()=>{document.getElementById("temperature").textContent=(17+Math.floor(Math.random()*8))+"°C";document.getElementById("humidity").textContent=(70+Math.floor(Math.random()*16))+"%"},5000);
updateUserUI();
const last=getSightings().slice(-1)[0];if(last)previewLastAnimal(last.name);
