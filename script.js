'use strict';

function hashStr(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),343291853);h=h<<13|h>>>19;}return(h^h>>>16)>>>0;}
function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function rngFor(key){return mulberry32(hashStr(key));}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function pick(rng,arr){return arr[Math.floor(rng()*arr.length)%arr.length];}
function flickerAlpha(t,seedOffset){
    const bucket=Math.floor((t+seedOffset)/90);
    const r=Math.abs(Math.sin(bucket*12.9898)*43758.5453)%1;
    return r<0.16?0.05:0.85;
}
function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}

const SAVE_KEY='estate-save-v1';
function defaultState(){
    return{
        currentRoom:null,
        rooms:{entrance:{visits:0},livingRoom:{visits:0},library:{visits:0},upstairs:{visits:0},bedroom:{visits:0},basement:{visits:0}},
        discoveries:[],
        playthrough:1,
        everCompleted:false,
        settings:{volume:70,subtitles:true,reduceMotion:false,reduceFlash:false,highContrast:false},
        inProgress:false
    };
}
function loadState(){
    try{
        const raw=localStorage.getItem(SAVE_KEY);
        if(!raw) return defaultState();
        const parsed=JSON.parse(raw);
        const d=defaultState();
        return Object.assign(d,parsed,{
            rooms:Object.assign(d.rooms,parsed.rooms||{}),
            settings:Object.assign(d.settings,parsed.settings||{})
        });
    }catch(e){return defaultState();}

}
let STATE=loadState();
let saveTimer=null;
function saveState(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
        try{localStorage.setItem(SAVE_KEY,JSON.stringify(STATE));}catch(e){}
    },150);
}


const Audio1={
    ctx:null, master:null,noiseBuffer:null,windSrc:null,windFilter: null,windGain:null, breathingSrc:null,breathingGain:null, clockTimer:null,
    ready:false,
    init(){
        if(this.ready)return;
        const AC=window.AudioContext||window.webkitAudioContext;
        this.ctx=new AC();
        this.master=this.ctx.createGain();
        this.master.gain.value=(STATE.settings.volume/100)*0.9;
        this.master.connect(this.ctx.destination);
        this.noiseBuffer=this._makeNoiseBuffer(4);
        this._startWind();
        this.ready=true;
    },
    setVolume(v){if(this.master)this.master.gain.setTargetAtTime((v/100)*0.9,this.ctx.currentTime,0.2);},
    _makeNoiseBuffer(seconds){
        const len=this.ctx.sampleRate*seconds;
        const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
        const data=buf.getChannelData(0);
        let last=0;
        for(let i=0;i<len;i++){const white=Math.random()*2-1;last=(last+0.02*white)/1.02;data[i]=last*3.0;}
        return buf;
    },
    _startWind(){
        const src=this.ctx.createBufferSource();src.buffer=this.noiseBuffer; src.loop=true;
        const filter=this.ctx.createBiquadFilter(); filter.type='lowpass';filter.frequency.value=420;
        const gain=this.ctx.createGain(); gain.gain.value=0.05 ;
        src.connect(filter);filter.connect(gain);gain.connect(this.master);
        src.start();
        this.windSrc=src; this.windFilter=filter;this.windGain =gain;
        const swell=()=>{
            if(!this.ctx)return;
            const t=this.ctx.currentTime;
            const target=180+Math.random()*520;
            const g=0.03+Math.random()*0.05;
            this.windFilter.frequency.setTargetAtTime(target,t,4);
            this.windGain.gain.setTargetAtTime(g,t,4);
            setTimeout(swell,6000+Math.random()*6000)
        };
        swell();
    },
    _burst(freqStart,freqEnd,dur,vol,pan){
        if(!this.ctx) return;
        const src=this.ctx.createBufferSource();src.buffer= this.noiseBuffer;
        const filter= this.ctx.createBiquadFilter();filter.type='bandpass';
        filter.frequency.setValueAtTime(freqStart,this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(Math.max(40,freqEnd),this.ctx.currentTime+dur)
        filter.Q.value=1.2;
        const g=this.ctx.createGain();g.gain.setValueAtTime(0.0001,this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(vol,this.ctx.currentTime+dur*0.25);
        g.gain.exponentialRampToValueAtTime(0.0001,this.ctx.currentTime+dur);
        let node=filter;
        if(this.ctx.createStereoPanner){
            const p=this.ctx.createStereoPanner();p.pan.value=pan||0;
            src.connect(filter);filter.connect(p);p.connect(g);g.connect(this.master);
        }else {src.connect(filter);filter.connect(g); g.connect(this.master);}
        src.start();src.stop( this.ctx.currentTime+dur+0.05);
    },
    creak(){this._burst(900,140,0.9,0.14,(Math.random()*2-1));UI.caption('the floor creaks,somewhere close');},
    knock(){this._burst(220,60,0.35,0.22,(Math.random()*2-1));UI.caption('a single knock,from the wall.');},
    whisper(){this._burst(2600,1800,1.4,0.05,(Math.random()*2-1));UI.caption('a whisper ,tooquiet to place.');},
    tick(){this._burst(2000,1900,0.04,0.08,0);},
    distantWalk(){this._burst(400,200,1.6,0.06,(Math.random()*2-1));UI.caption('footsteps,somewhere above.');},
    screech(){
        if(!this.ctx) return;
        const t=this.ctx.currentTime;
        const src=this.ctx.createBufferSource(); src.buffer=this.noiseBuffer;
        const filt=this.ctx.createBiquadFilter();filt.type='bandpass';
        filt.frequency.setValueAtTime(3200,t);
        filt.frequency.exponentialRampToValueAtTime(220,t+0.4);
        filt.Q.value=6;
        const ng=this.ctx.createGain();ng.gain.setValueAtTime(0.0001,t);
        ng.gain.exponentialRampToValueAtTime(0.9,t+0.03);
        ng.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
        src.connect(filt);filt.connect(ng);ng.connect(this.master);
        src.start();src.stop(t+0.65);
        const osc=this.ctx.createOscillator();osc.type='sawtooth';
        osc.frequency.setValueAtTime(1400,t);
        osc.frequency.exponentialRampToValueAtTime(70,t+0.5);
        const og=this.ctx.createGain();og.gain.setValueAtTime(0.0001,t);
        og.gain.exponentialRampToValueAtTime(0.7,t+0.03);
        og.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
        osc.connect(og);og.connect(this.master );
        osc.start();osc.stop(t+0.6)
    },
    startClock(){
        this.stopClock();
        this.clockTimer=setInterval(()=>this.tick(),1000);
    },
    stopClock(){if(this.clockTimer){clearInterval(this.clockTimer);this.clockTimer=null;}},
    startBreathing(){
        if(!this.ctx || this.breathingSrc) return;
        const src=this.ctx.createBufferSource();src.buffer=this.noiseBuffer;src.loop=true;
        const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=260;
        const gain=this.ctx.createGain();gain.gain.value= 0;
        src.connect(filter);filter.connect(gain);gain.connect(this.master);
        src.start();
        this.breathingSrc=src;this.breathingGain=gain;
        const t=this.ctx.currentTime;
        gain.gain.linearRampToValueAtTime(0.05,t+2);
        this._breathLFO(gain);
        UI.caption('you become aware of breathing that is not your own');
    },
    _breathLFO(gain){
        if(!this.breathingSrc)return;
        const t= this.ctx.currentTime;
        const base=this.breathingGain===gain?0.05:0.05;
        gain.gain.setTargetAtTime(0.02,t,0.9);
        gain.gain.setTargetAtTime(0.06,t+1.8,0.9);
        if(this.breathingSrc) this._breathTimer=setTimeout(()=>this._breathLFO(gain),3600);
    },
    stopBreathing(){
        if(!this.breathingSrc)return;
        const t=this.ctx.currentTime;
        this.breathingGain.gain.setTargetAtTime(0,t,0.3);
        clearTimeout(this._breathTimer);
        const src=this.breathingSrc;this.breathingSrc=null;
        setTimeout(()=>{try{src.stop();}catch(e){}},1000);
    }
};

const SCENE_W=2400, SCENE_H=1000, HORIZON=430;
function hatch(ctx,x,y,w,h,angle,spacing,alpha){
  ctx.save();
  ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.strokeStyle='rgba(0,0,0,'+alpha+')';ctx.lineWidth=1;
  const diag=Math.sqrt(w*w+h*h);
  ctx.translate(x+w/2,y+h/2); ctx.rotate(angle);
  for(let i=-diag;i<diag;i+=spacing){
    ctx.beginPath();ctx.moveTo(i,-diag);ctx.lineTo (i,diag);ctx.stroke();}
  ctx.restore();
}
function stipple(ctx,cx,cy,r,count,rng,alpha){
  ctx.fillStyle='rgba(0,0,0,'+alpha+')';
  for(let i=0;i<count;i++){
    const a=rng()*Math.PI*2,d=rng()*r;
    const x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d*0.4;
    ctx.fillRect(x,y,1+rng()*1.6,1+rng()*1.6);
  }
}
function baseShadow(ctx,cx,floorY,w,skew){
  ctx.fillStyle='rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx-w/2,floorY);
  ctx.lineTo(cx+w/2,floorY);
  ctx.lineTo (cx+w/2+skew,floorY+16);
  ctx.lineTo(cx-w/2+skew,floorY+16);
  ctx.closePath();ctx.fill();
}
function drawBase (ctx,rng,opts){
  opts=opts||{};
  const wall=opts.wallTop||'#20180f',floor=opts.floorTop||'#0c0805';
  ctx.fillStyle=wall;ctx.fillRect(0,0,SCENE_W,HORIZON);
  for(let i=0;i<5;i++) {
    const hx=rng()*SCENE_W, hw=180+rng()*220;
    hatch(ctx,hx,0,hw,HORIZON-70,Math.PI*0.28,3.5,0.16);
  }
  ctx.strokeStyle='rgba(0,0,0,0.7)';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(0,HORIZON-70); ctx.lineTo(SCENE_W,HORIZON-70);ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1; 
  ctx.beginPath();ctx.moveTo(0,HORIZON-64);ctx.lineTo(SCENE_W,HORIZON-64);ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,0.5)';ctx.lineWidth=2;
  for(let x=0;x<SCENE_W;x+=220){
    const jitter=(rng()-0.5)*10;
    ctx.beginPath();ctx.moveTo(x+jitter,0);ctx.lineTo(x+jitter,HORIZON-70);ctx.stroke();
  }
  const stainCount=2+Math.floor(rng()*2);
  for(let s=0;s<stainCount;s++) {
    const sx=rng()*SCENE_W,sy=HORIZON-90-rng()*180, sr=40+rng()*50;
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.beginPath();
    for (let a=0;a<8;a++){
      const ang=(a/8)*Math.PI*2,rr=sr*(0.7+rng()*0.5);
      const px=sx+Math.cos(ang)*rr,py=sy+Math.sin(ang)*rr*0.6;
      a===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.closePath();ctx.fill();
  }
  ctx.strokeStyle='rgba(0,0,0,0.65)';ctx.lineWidth=1.5;
  const crackCount=5+Math.floor(rng()*4);
  for(let i=0;i<crackCount;i++){
    let x=rng()*SCENE_W,y=rng()*HORIZON*0.7;
    ctx.beginPath();ctx.moveTo(x,y);
    for(let s=0;s<5;s++){ x+=(rng()-0.5)*46;y+=rng()*20; ctx.lineTo(x,y);}
    ctx.stroke();
  }
  ctx.strokeStyle='rgba(0,0,0,0.75)';ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(0,4);ctx.lineTo(SCENE_W,4);ctx.stroke();
  ctx.fillStyle=floor; ctx.fillRect(0,HORIZON,SCENE_W,SCENE_H-HORIZON);
  hatch(ctx,0,HORIZON,SCENE_W,SCENE_H-HORIZON,Math.PI*0.5,4,0.10);
  ctx.strokeStyle='rgba(0,0,0,0.55)';ctx.lineWidth=2;
  for(let y=HORIZON+18;y<SCENE_H;y+=26) {
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(SCENE_W,y);ctx.stroke();
  }
  for(let x=0;x<SCENE_W;x+=140){
    const jitter=(rng()-0.5)*16;
    ctx.beginPath(); ctx.moveTo (x+jitter,HORIZON);ctx.lineTo(x+jitter*0.4,SCENE_H);ctx.stroke();
  }
  for(let i=0;i<4;i++){
    stipple(ctx,rng()*SCENE_W,HORIZON+60+rng()*100,220,140,rng,0.05);
  }
}
function doorShape(ctx,cx,w,h,opts){
  opts=opts||{};
  const y=HORIZON-h,x=cx-w/2;
  baseShadow(ctx,cx,HORIZON,w+40,10);
  ctx.fillStyle=opts.fill||'#171009';
  ctx.strokeStyle='rgba(0,0,0,0.8)';ctx.lineWidth=4;
  ctx.fillRect(x-10,y-10,w+20,h+14);ctx.strokeRect(x-10,y-10,w+20,h+14);
  ctx.strokeStyle='rgba(0,0,0,0.7)';ctx.lineWidth=2;
  [[x-10,y-10],[x+w+10,y-10]].forEach(([cx2,cy2])=>{
    ctx.beginPath();ctx.moveTo(cx2,cy2+14);ctx.lineTo(cx2+(cx2<x?14:-14),cy2);ctx.stroke();
  });
  ctx.fillStyle=opts.panel||'#221809';
  ctx.fillRect(x,y,w,h);
  hatch(ctx,x,y,w,h,Math.PI/2,3,0.14);
  ctx.strokeStyle='rgba(0,0,0,0.6)';ctx.lineWidth=3;
  roundRect(ctx,x+w*0.14,y+h*0.07,w*0.72,h*0.4,3);ctx.stroke();
  roundRect(ctx,x+w*0.14,y+h*0.55,w*0.72,h*0.4,3);ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,0.6)';
  ctx.fillRect(x-9,y+h*0.12,7,18);ctx.fillRect(x-9,y+h*0.8,7,18);
  if(opts.ajar){
    ctx.save();ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(x+w*0.15,y,w*0.35,h);ctx.restore();
  }
  ctx.fillStyle='rgba(0,0,0,0.65)';
  ctx.beginPath();ctx.arc(x+w-16,y+h*0.5,4.5,0,Math.PI*2);ctx.fill();
  return{x:x-10,y:y-10,w:w+20,h:h+14};
}
 
function portraitShape(ctx,cx,y,w,h,kind){
  const x=cx-w/2;
  baseShadow(ctx,cx,y+h+6,w+18,8);
  ctx.strokeStyle='rgba(0,0,0,0.75)';ctx.lineWidth=6;
  ctx.fillStyle='#0a0603';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
  ctx.strokeStyle='rgba(0,0,0,0.85)';ctx.lineWidth=3;
  const cl=14;
  [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx2,cy2],i)=>{
    ctx.beginPath();
    const sx=i%2===0?1:-1, sy=i<2?1:-1;
    ctx.moveTo(cx2, cy2+cl*sy); ctx.lineTo(cx2,cy2);ctx.lineTo(cx2+cl*sx,cy2);
    ctx.stroke();
  });
  if(kind==='blank')return;
  ctx.fillStyle='#1e160d';ctx.fillRect(x+6,y+6,w-12,h-12);
  hatch(ctx,x+6,y+6,w-12,h-12,Math.PI*0.75,3,0.22);
  ctx.fillStyle='#120d08';
  ctx.beginPath();ctx.arc(cx,y+h*0.36,w*0.22,0,Math.PI*2);ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx-w*0.3,y+h*0.92);ctx.quadraticCurveTo(cx,y+h*0.5,cx+w*0.3,y+h*0.92);
  ctx.closePath();ctx.fill();
  if(kind==='front') {
    ctx.fillStyle='rgba(231,226,216,0.75)';
    ctx.beginPath();ctx.arc(cx-w*0.06,y+h*0.34,2.2,0,Math.PI*2);ctx.fill();
    ctx.beginPath(); ctx.arc(cx+w*0.06,y+h*0.34,2.2,0,Math.PI*2);ctx.fill();
  }
}
 
function furnitureBlock(ctx,cx,w,h,style){
  const x=cx-w/2,y=HORIZON-h;
  baseShadow(ctx,cx,HORIZON,w+30,12);
  ctx.fillStyle='#1c150d';roundRect(ctx,x,y,w,h,style==='soft'?14:3);ctx.fill();
  hatch(ctx,x,y,w,h,Math.PI*0.32,3,0.16);
  ctx.strokeStyle='rgba(0,0,0,0.75)';ctx.lineWidth=3;ctx.stroke();
  if(style==='shelf'){ 
    for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(x+4,y+h*i/5);ctx.lineTo(x+w-4,y+h*i/5);ctx.stroke();}
    const rng2=rngFor('shelf'+cx+w);
    for(let i=0;i<5;i++){
      const rowY=y+h*i/5+6,rowH=h/5-10;
      let bx=x+8;
      while(bx<x+w-8){
        const bw=6+rng2()*10;
        ctx.fillStyle='rgba(0,0,0,'+(0.3+rng2()*0.3)+')';
        ctx.fillRect(bx,rowY,bw-1,rowH*(0.7+rng2()*0.3));
        bx+=bw;
      }
    }
  }else if(style==='panel'){
    ctx.beginPath();ctx.moveTo(cx,y+6);ctx.lineTo(cx,y+h-6);ctx.stroke();
    ctx.fillStyle='rgba(0,0,0,0.7)';ctx.beginPath();ctx.arc(x+w*0.24,y+h*0.5,3,0,Math.PI*2);ctx.fill();
  }else if(style==='soft'){
    ctx.beginPath();ctx.moveTo(x+8,y+10);ctx.lineTo(x+w-8,y+10);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+w*0.5,y+10);ctx.lineTo(x+w*0.5,y+h-8);ctx.stroke();
    ctx.strokeRect(x+6,y+4,20,h*0.5);
    ctx.strokeRect(x+w-26,y+4,20,h*0.5);
  } else if(style==='machine'){
    ctx.fillStyle='rgba(0,0,0,0.55)';
    for(let i=0;i<6;i++){ctx.beginPath(); ctx.arc(x+8+((i*17)%(w-16)),y+10+((i*29)%(h-20)),2.4,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='rgba(0,0,0,0.6)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x+w*0.2,y);ctx.lineTo(x+w*0.2,y+h);ctx.moveTo(x+w*0.7,y);ctx.lineTo(x+w*0.7,y+h);ctx.stroke();
  }
  return {x,y,w,h};
}
function windowShape(ctx,cx,w,h){
  const x=cx-w/2,y=HORIZON-h-40;
  ctx.fillStyle='#020304';ctx.fillRect(x,y,w,h);
  hatch(ctx,x,y,w,h*0.4,Math.PI*0.2,4,0.3);
  ctx.strokeStyle='rgba(0,0,0,0.8)';ctx.lineWidth=8;ctx.strokeRect(x,y,w,h);
  ctx.beginPath();ctx.moveTo(cx,y);ctx.lineTo(cx,y+h);ctx.moveTo(x,y+h/2);ctx.lineTo(x+w,y+h/2);
  ctx.lineWidth=3;ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x+w*0.15,y+h*0.1);ctx.lineTo(x+w*0.5,y+h*0.7);ctx.stroke();
}

const Runtime={bedroomTimers:[],ambientTimer:null,revealTimer:null};
function clearBedroomTimers(){Runtime.bedroomTimers.forEach(id=>clearTimeout(id));Runtime.bedroomTimers=[];}

const Game={
  paused:false,
  discover(id){
    if(!id) return;
    if(STATE.discoveries.indexOf(id)===-1){ STATE.discoveries.push(id); saveState(); }
  },
  allSecretsFound(){
    const need=['fourth_portrait','facing_photo','diary_change','door_count','mirror_anomaly'];
    return need.every(n=>STATE.discoveries.indexOf(n)!==-1);
  },
  enterRoom(roomId,opts){
    opts=opts||{};
    const prev=STATE.currentRoom;
    if(prev && ROOMS[prev]&& ROOMS[prev].onLeave)ROOMS[prev].onLeave();
    STATE.currentRoom=roomId;
    if(opts.increment!==false)STATE.rooms[roomId].visits+=1;
    STATE.inProgress=true;
    const variant=ROOMS[roomId].variantKey();
    Scene.enter(roomId,variant);
    if(ROOMS[roomId].onEnter)ROOMS[roomId].onEnter();
    this.maybeRandomFlavor(roomId);
    UI.updateRoomName(ROOMS[roomId].name);
    UI.announce(ROOMS[roomId].name+'. You look around, and take it in.');
    saveState();
  },
  maybeRandomFlavor(roomId){
    const chance=ANOMALY_CHANCE[roomId]||0.2;
    if(Math.random()<chance){
      const rng=Math.random;
      setTimeout(()=>{if(STATE.currentRoom===roomId)UI.caption(pick(rng,RANDOM_FLAVOR));},2800+Math.random()*3200);
    }
  },
  transitionTo(target){
    const curtain=document.getElementById('curtain'),text=document.getElementById('curtain-text');
    const lines=['restoring environment...','please don\u2019t look behind you.','the room remembers you.','recalculating the house.',''];
    text.textContent=Math.random()<0.35?pick(Math.random,lines):'';
    curtain.classList.add('show');
    setTimeout(()=>{
      Game.enterRoom(target);
      setTimeout(()=>curtain.classList.remove('show'),80);
    },520);
  },
  activateHotspot(hs){
    if(hs.type==='door'){this.transitionTo(hs.target);return; }
    if(hs.type==='jumpscare'){this.triggerJumpscare(); return; }
    if(hs.type==='action' &&hs.action==='reveal'){this.startReveal();return; }
    if(hs.discovery)this.discover(hs.discovery);
    if(hs.action==='wardrobe')this.onWardrobeLook();
    UI.openNote(hs.label,hs.text);
  },
  triggerJumpscare(){
    if(this._scaring)return;
    this._scaring=true;
    const overlay=document.getElementById('jumpscare-overlay');
    const video=document.getElementById('jumpscare-video');
    const lose=document.getElementById('jumpscare-lose');
    const showLose=()=>{
      video.classList.add('hidden');video.pause();
      overlay.classList.remove('jump-shake');
      lose.classList.remove('hidden');
      this._endScare=null;
    };
    if(STATE.settings.reduceFlash){
      Audio1.knock();Audio1.knock();
      UI.caption('something slams against the other side of the door.');
      overlay.classList.remove('hidden');
      video.classList.add('hidden');
      setTimeout(showLose,900);
      return;
    }
    Audio1.screech();
    overlay.classList.remove('hidden');
    video.classList.remove('hidden');
    lose.classList.add('hidden');
    overlay.classList.add('jump-shake');
    try{
      video.currentTime=0;video.muted=false;video.volume=1.0;
      const p=video.play();
      if(p && p.catch) p.catch(()=>{});
    }catch(e){}
    const skip=()=>{video.removeEventListener('ended',skip);overlay.removeEventListener('click',skip);showLose();};
    video.addEventListener('ended',skip);
    overlay.addEventListener('click',skip);
    this._endScare=skip;
    setTimeout(()=>{ if(this._endScare===skip)skip();},9000);
  },
  jumpscareRestart(){
    const overlay=document.getElementById('jumpscare-overlay');
    document.getElementById('jumpscare-video').classList.remove('hidden');
    document.getElementById('jumpscare-lose').classList.add('hidden');
    overlay.classList.add('hidden');
    this._scaring=false;this._endScare=null;
    this.restart();
  },
  jumpscareHome(){
    const overlay=document.getElementById('jumpscare-overlay');
    document.getElementById('jumpscare-video').classList.remove('hidden');
    document.getElementById('jumpscare-lose').classList.add('hidden');
    overlay.classList.add('hidden');
    this._scaring=false;this._endScare=null;
    clearBedroomTimers();Audio1.stopBreathing();Audio1.stopClock();
    STATE.currentRoom=null;STATE.inProgress=false;saveState();
    UI.showScreen('screen-landing');
    refreshLanding();
  },
  onWardrobeLook(){
    STATE._lookingAtWardrobe=true;
    if(Audio1.breathingSrc){
      Audio1.stopBreathing();
      const id=setTimeout(()=>{ if(STATE.currentRoom==='bedroom')Audio1.knock();},2600);
      Runtime.bedroomTimers.push(id);
    }
  },
  scheduleBedroom(){
    clearBedroomTimers();
    const enterId=setTimeout(()=>{
      if(STATE.currentRoom==='bedroom'&& !STATE._lookingAtWardrobe){Audio1.startBreathing();}
    },14000);
    Runtime.bedroomTimers.push(enterId);
  },
  startReveal(){
    const curtain=document.getElementById('curtain'),text=document.getElementById('curtain-text');
    curtain.classList.add('show');
    const lines=['CAMERA 01-THE ENTRANCE HALL','CAMERA 02-THE LIBRARY','CAMERA 03-THE UPSTAIRS HALL','CAMERA 04-THIS ROOM'];
    let i=0;
    text.textContent='';
    const step=()=>{
      if(i<lines.length){text.textContent=lines[i];i++;setTimeout(step,1500);}
      else if(i===lines.length){
        text.textContent='';i++;
        setTimeout(step,900);
      } else if(i===lines.length+1){
        text.textContent='CAMERA 05';i++;
        setTimeout(step,1300);
      } else if(i===lines.length+2){
        text.textContent='CAMERA 05-BEHIND YOU';i++;
        setTimeout(step,1500);
      } else {
        text.textContent='';
        setTimeout(()=>Game.finishTour(),700);
      }
    };
    step();
  },
  finishTour(){
    const trueEnd=this.allSecretsFound();
    STATE.everCompleted=true; STATE.inProgress=false; STATE.currentRoom=null;
    saveState();
    document.getElementById('ending-sub').textContent=trueEnd?'Thank you for staying.':'Thank you for visiting.';
    document.getElementById('ending-body').textContent=trueEnd
      ? "You noticed. Not everything \u2014 the house is patient, and so are the things that watch it \u2014 but you noticed enough. It will remember that, even if you'd rather it didn't."
      : "You leave the way you came. The house, gracious host that it is, lets you believe that's true.";
    document.getElementById('curtain').classList.remove('show');
    UI.showScreen('screen-ending');
  },
  beginNewTour(){
    STATE.rooms=defaultState().rooms;
    STATE.discoveries=[];
    STATE.currentRoom=null;
    STATE.inProgress=true;
    STATE._lastUpstairsCount=null;
    saveState();
    UI.startLoadingSequence(()=>{UI.showScreen('screen-game');Game.enterRoom('entrance');});
  },
  resumeTour(){
    UI.showScreen('screen-game');
    Game.enterRoom(STATE.currentRoom||'entrance',{increment:false});
  },
  restart(){
    clearBedroomTimers();Audio1.stopBreathing();Audio1.stopClock();
    this.beginNewTour();
  }
};

const Scene={
  canvas:null,ctx:null,hotspotLayer:null,tiltWrapper:null,
  cache:new Map(),
  roomId:null,variant:null,hotspots:[],
  panX:0,tiltDeg:0,dragging:false,lastX:0,lastY:0,
  scale:1,dpr:1,
  init(){
    this.canvas=document.getElementById('scene');
    this.ctx=this.canvas.getContext('2d');
    this.hotspotLayer=document.getElementById('hotspot-layer');
    this.tiltWrapper=document.getElementById('tilt-wrapper');
    const c=this.canvas;
    c.addEventListener('pointerdown',e=>{this.dragging=true;this.lastX=e.clientX;this.lastY=e.clientY;});
    c.addEventListener('pointermove',e=>{
      if(!this.dragging)return;
      const dx=e.clientX-this.lastX,dy=e.clientY-this.lastY;
      this.lastX=e.clientX;this.lastY=e.clientY;
      const cssScale=this.scale/this.dpr||1;
      this.panX=clamp(this.panX-dx/cssScale,0,this.maxPan());
      this.tiltDeg=clamp(this.tiltDeg-dy*0.06,-8,8);
    });
    window.addEventListener('pointerup',()=>{this.dragging=false;});
    window.addEventListener('keydown',e=>{
      if(!document.getElementById('screen-game').classList.contains('active'))return;
      if(!document.getElementById('note-modal').classList.contains('hidden'))return;
      if(Game.paused)return;
      if(e.key==='ArrowLeft'){this.panX=clamp(this.panX-110,0,this.maxPan());}
      if(e.key==='ArrowRight'){this.panX=clamp(this.panX+110,0,this.maxPan());}
    });
    requestAnimationFrame(t=>this.frame(t));
  },
  maxPan(){return Math.max(0,SCENE_W-this.visibleW());},
  visibleW(){return this.canvas.width/(this.scale||1);},
  resize(){
    const rect=this.canvas.getBoundingClientRect();
    this.dpr=Math.min(window.devicePixelRatio||1,2);
    this.canvas.width=Math.max(1,Math.round(rect.width*this.dpr));
    this.canvas.height=Math.max(1,Math.round(rect.height*this.dpr));
    this.scale=this.canvas.height/SCENE_H;
  },
  getSceneCanvas(roomId,variantKey){
    const key=roomId+'|'+variantKey;
    if(this.cache.has(key))return this.cache.get(key);
    const off=document.createElement('canvas');off.width=SCENE_W;off.height=SCENE_H;
    const octx=off.getContext('2d');
    const rng=rngFor(key);
    ROOMS[roomId].build(octx,rng,variantKey);
    this.cache.set(key,off);
    return off;
  },
  enter(roomId,variant){
    this.roomId=roomId;this.variant=variant;
    this.hotspots=ROOMS[roomId].hotspots(variant);
    this.resize();
    this.panX=clamp(this.panX,0,this.maxPan());
    this.rebuildHotspots();
  },
  rebuildHotspots(){
    this.hotspotLayer.innerHTML='';
    this.hsEls=this.hotspots.map(hs=>{
      const btn=document.createElement('button');
      btn.className='hotspot';btn.type='button';
      btn.setAttribute('aria-label',hs.label);
      const lab=document.createElement('span');lab.className='label';lab.textContent=hs.label;
      btn.appendChild(lab);
      btn.addEventListener('click',()=>Game.activateHotspot(hs));
      this.hotspotLayer.appendChild(btn);
      return{hs,btn};
    });
  },
  frame(t){
    if(this.canvas && this.canvas.getBoundingClientRect().width>0){
      const rect=this.canvas.getBoundingClientRect();
      if(Math.round(rect.width*this.dpr)!==this.canvas.width||Math.round(rect.height*this.dpr)!==this.canvas.height){
        this.resize();
      }
      if(this.roomId){
        const off=this.getSceneCanvas(this.roomId,this.variant);
        const ctx=this.ctx;
        const visW=this.visibleW();
        this.panX=clamp(this.panX,0,this.maxPan());
        ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        ctx.drawImage(off,this.panX,0,visW,SCENE_H,0,0,this.canvas.width,this.canvas.height);
        this.drawDynamic(ctx,t);
        if(!document.body.classList.contains('reduce-motion')){
          this.tiltWrapper.style.transform='perspective(900px) rotateX('+this.tiltDeg+'deg)';
        }else if(this.tiltWrapper.style.transform){
          this.tiltWrapper.style.transform='';
        }
        this.positionHotspots();
      }
    }
    requestAnimationFrame(tt=>this.frame(tt));
  },
  drawDynamic(ctx,t){
    ctx.save();
    ctx.setTransform(this.scale,0,0,this.scale,-this.panX*this.scale,0);
    const flash=!document.body.classList.contains('reduce-flash');
    if(this.roomId==='entrance'){
      const a=flash?flickerAlpha(t,0):0.7;
      ctx.fillStyle='rgba(210,205,195,'+a+')';
      ctx.fillRect(1194,20,12,12);
    }
    if(this.roomId==='library'){
      const a=flash?flickerAlpha(t,340):0.7;
      ctx.fillStyle='rgba(210,205,195,'+a+')';
      ctx.fillRect(1444,HORIZON-101,10,10);
    }
    if(this.roomId==='bedroom'){
      const mx=1300,mw=180,mh=240,my=HORIZON-260;
      ctx.save();ctx.beginPath();ctx.rect(mx-mw/2+4,my+4,mw-8,mh-8);ctx.clip();
      if(this.variant==='delay'){
        const off=Math.sin(t*0.0015)*6;
        ctx.fillStyle='rgba(20,26,28,0.35)';
        ctx.fillRect(mx-mw/2+off,my,mw,mh);
      }else if(this.variant==='facing'){
        ctx.fillStyle='rgba(8,10,10,0.55)';
        ctx.beginPath();ctx.arc(mx,my+mh*0.42,26,0,Math.PI*2); ctx.fill();
        ctx.beginPath();ctx.moveTo(mx-30,my+mh*0.95); ctx.quadraticCurveTo(mx,my+mh*0.55,mx+30,my+mh*0.95);
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  },
  positionHotspots(){
    const cssScale=this.scale/this.dpr;
    const clientW=this.canvas.clientWidth,clientH=this.canvas.clientHeight;
    this.hsEls.forEach(({hs,btn})=>{
      const x=(hs.sceneX-this.panX)*cssScale;
      const y=clientH*(hs.yFrac||0.62);
      if(x< -80||x>clientW+80){btn.style.display='none';}
      else{btn.style.display='block';btn.style.left=x+'px';btn.style.top=y+'px';}
    });
  }
};


const UI={
  captionTimer:null,
  showScreen(id){
    document.querySelectorAll ('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  },
  caption(txt){
    this.announce(txt);
    if(!STATE.settings.subtitles)return;
    const el=document.getElementById('caption');
    el.textContent=txt; el.classList.add('show');
    clearTimeout(this.captionTimer);
    this.captionTimer=setTimeout(()=>el.classList.remove('show'),3600);
  },
  announce(txt){document.getElementById('sr-announcer').textContent=txt;},
  updateRoomName(name){
    const el=document.getElementById('room-name');
    el.classList.remove('show');
    setTimeout(()=>{el.textContent=name; el.classList.add('show');},250);
    setTimeout(()=>{el.classList.remove('show');},5200);
  },
  openNote(title,text){
    const modal=document.getElementById('note-modal');
    document.getElementById('note-title').textContent=title;
    const body=document.getElementById('note-body');
    body.innerHTML='';
    const p=document.createElement('p'); p.textContent=text||''; body.appendChild(p);
    modal.classList.remove('hidden');
    requestAnimationFrame(()=>modal.classList.add('show'));
    document.getElementById('note-close').focus();
  },
  closeNote(){
    const modal=document.getElementById('note-modal');
    modal.classList.remove('show');
    setTimeout(()=>modal.classList.add('hidden'),350);
  },
  startLoadingSequence(done){
    this.showScreen('screen-loading');
    const rowsEl=document.getElementById('loading-rows');
    const warnEl=document.getElementById('loading-warn');
    rowsEl.innerHTML='';warnEl.classList.remove('show');warnEl.textContent='';
    const rooms=['ROOM 01','ROOM 02','ROOM 03','ROOM 04'];
    rooms.forEach((r,i)=>{
      const row=document.createElement('div');row.className='loading-row';
      row.innerHTML='<span>'+r+' - restoring</span><span class="ok">complete</span>';
      rowsEl.appendChild(row);
      setTimeout(()=>row.classList.add('show'),260+i*340);
    });
    setTimeout(()=>{
      if(Math.random()<0.7){warnEl.textContent='please don\u2019t look behind you';warnEl.classList.add('show');}
    },260+rooms.length*340+300);
    setTimeout(done,260+rooms.length*340+1500);
  },
  applySettings(){
    document.body.classList.toggle('reduce-motion',STATE.settings.reduceMotion);
    document.body.classList.toggle('reduce-flash',STATE.settings.reduceFlash);
    document.body.classList.toggle('high-contrast',STATE.settings.highContrast);
    document.getElementById('s-volume').value=STATE.settings.volume;
    document.getElementById('s-subtitles').checked=STATE.settings.subtitles;
    document.getElementById('s-reduce-motion').checked=STATE.settings.reduceMotion;
    document.getElementById('s-reduce-flash').checked=STATE.settings.reduceFlash;
    document.getElementById('s-contrast').checked=STATE.settings.highContrast;
    if(Audio1.ready)Audio1.setVolume(STATE.settings.volume);
  }
};


function initGrain(){
  const c=document.getElementById('grain');
  const ctx=c.getContext('2d');
  const tile=document.createElement('canvas');tile.width=96;tile.height=96;
  const tctx=tile.getContext('2d');
  const img=tctx.createImageData(96,96);
  for(let i=0;i<img.data.length;i+=4){ const v=Math.random()*255;img.data[i]=v;img.data[i+1]=v;img.data[i+2]=v;img.data[i+3]=40;}
  tctx.putImageData(img,0,0);
  function resize(){c.width=window.innerWidth;c.height=window.innerHeight;}
  resize();window.addEventListener('resize',resize);
  const pattern=ctx.createPattern(tile,'repeat');
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    ctx.save();
    ctx.translate(Math.random()*96,Math.random()*96);
    ctx.fillStyle=pattern;ctx.fillRect(-96,-96,c.width+192,c.height+192);
    ctx.restore();
    setTimeout(()=>requestAnimationFrame(draw),90);
  }
  draw();
}
function initLandingFog(){
  const c=document.getElementById('landing-fog');
  const ctx=c.getContext('2d');
  function resize(){c.width=window.innerWidth;c.height=window.innerHeight;}
  resize();window.addEventListener('resize',resize);
  const rng=rngFor('landing-dust');
  const dust=Array.from({length:90},()=>({x:rng(),y:0.55+rng()*0.45,s:0.3+rng()*0.7,drift:(rng()-0.5)*0.02}));
  let running=false;
  function frameStep(t){
    if(!document.getElementById('screen-landing').classList.contains('active')){running=false; return;}
    ctx.fillStyle='#050403';ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle='rgba(0,0,0,0.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,c.height*0.82);ctx.lineTo(c.width,c.height*0.82);ctx.stroke();
    ctx.fillStyle='rgba(180,175,165,0.5)';
    dust.forEach(d=>{
      const x=((d.x*c.width)+t*d.drift)%(c.width+40);
      const y=d.y*c.height+Math.sin(t*0.0004+d.x*10)*6;
      ctx.fillRect(x,y,d.s,d.s);
    });
    requestAnimationFrame(frameStep);
  }
  function ensureRunning(){
    if(running)return;
    running=true;
    requestAnimationFrame(frameStep);
  }
  ensureRunning();
  setInterval(ensureRunning,700);
}


function startAmbientScheduler(){
  if(Runtime.ambientTimer)return;
  const tick=()=>{
    if(STATE.currentRoom &&!Game.paused && Audio1.ready){
      const roll=Math.random();
      if(roll<0.28)Audio1.creak();
      else if(roll<0.42) Audio1.whisper();
      else if(roll<0.5)Audio1.knock();
      else if(roll<0.56)Audio1.distantWalk();
    }
    Runtime.ambientTimer=setTimeout(tick,9000+Math.random()*9000);
  };
  Runtime.ambientTimer=setTimeout(tick,7000);
}


function wireUI(){
  document.getElementById('btn-enter').addEventListener('click',()=>{
    Audio1.init();startAmbientScheduler();
    Game.beginNewTour();
  });
  document.getElementById('btn-continue').addEventListener('click',()=>{
    Audio1.init();startAmbientScheduler();
    Game.resumeTour();
  });
  document.getElementById('note-close').addEventListener('click',()=>UI.closeNote());
  document.getElementById('note-modal').addEventListener('click',e=>{if(e.target.id==='note-modal')UI.closeNote();});
  document.getElementById('btn-settings').addEventListener('click',()=>{Game.paused=true;document.getElementById('screen-pause').classList.add('active');});
  document.getElementById('btn-resume').addEventListener('click',()=>{Game.paused=false;document.getElementById('screen-pause').classList.remove('active');});
  document.getElementById('btn-exit').addEventListener('click',()=>{
    Game.paused=false;document.getElementById('screen-pause').classList.remove('active');
    STATE.inProgress=!!STATE.currentRoom;
    saveState();
    UI.showScreen('screen-landing');
    refreshLanding();
  });
  document.getElementById('btn-restart').addEventListener('click',()=>{
    document.getElementById('screen-pause').classList.remove('active');Game.paused=false;
    Game.restart();
  });
  document.getElementById('btn-controls').addEventListener('click',()=>{
    document.getElementById('screen-pause').classList.remove('active');
    document.getElementById('screen-controls').classList.add('active');
  });
  document.getElementById('btn-controls-back').addEventListener('click',()=>{
    document.getElementById('screen-controls').classList.remove('active');
    document.getElementById('screen-pause').classList.add('active');
  });
  document.getElementById('btn-open-settings').addEventListener('click',()=>{
    document.getElementById('screen-pause').classList.remove('active');
    document.getElementById('screen-settings').classList.add('active');
  });
  document.getElementById('btn-settings-back').addEventListener('click',()=>{
    document.getElementById('screen-settings').classList.remove('active');
    document.getElementById('screen-pause').classList.add('active');
  });
  document.getElementById('s-volume').addEventListener('input',e=>{STATE.settings.volume=parseInt(e.target.value,10);Audio1.setVolume(STATE.settings.volume); saveState(); });
  document.getElementById('s-subtitles').addEventListener('change',e=>{STATE.settings.subtitles=e.target.checked;saveState();});
  document.getElementById('s-reduce-motion').addEventListener('change',e=>{STATE.settings.reduceMotion=e.target.checked;UI.applySettings();saveState();});
  document.getElementById('s-reduce-flash').addEventListener('change',e=>{STATE.settings.reduceFlash=e.target.checked;UI.applySettings();saveState();});
  document.getElementById('s-contrast').addEventListener('change',e=>{STATE.settings.highContrast=e.target.checked;UI.applySettings();saveState();});
  document.getElementById('btn-again').addEventListener('click',()=>{
    STATE.playthrough=(STATE.playthrough||1)+1;saveState();
    Game.beginNewTour();
  });
  document.getElementById('btn-home').addEventListener('click',()=>{UI.showScreen('screen-landing');refreshLanding();});
  document.getElementById('btn-jumpscare-restart').addEventListener('click',()=>Game.jumpscareRestart());
  document.getElementById('btn-jumpscare-home').addEventListener('click',()=>Game.jumpscareHome());

  window.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(Game._endScare){Game._endScare();return;}
    if(!document.getElementById('jumpscare-overlay').classList.contains('hidden'))return;
    const modal=document.getElementById('note-modal');
    if(!modal.classList.contains('hidden') &&modal.classList.contains('show')){UI.closeNote(); return;}
    if(!document.getElementById('screen-game').classList.contains('active'))return;
    const controls=document.getElementById('screen-controls'),settings=document.getElementById('screen-settings'),pause=document.getElementById('screen-pause');
    if(controls.classList.contains('active')){controls.classList.remove('active');pause.classList.add('active'); return; }
    if(settings.classList.contains('active')){settings.classList.remove('active');pause.classList.add('active');return; }
    if(pause.classList.contains('active')){pause.classList.remove('active');Game.paused=false;return;}
    Game.paused=true; pause.classList.add('active');
  });
}
function refreshLanding(){
  document.getElementById('btn-continue').classList.toggle('hidden',!(STATE.inProgress && STATE.currentRoom));
  document.getElementById('landing-note').textContent = STATE.everCompleted ? 'you\u2019ve been here before.' : '';
}

function init(){
  Scene.init();
  wireUI();
  UI.applySettings();
  initGrain();
  initLandingFog();
  refreshLanding();
  const jv=document.getElementById('jumpscare-video');
  if(jv){jv.load();}
}
document.addEventListener('DOMContentLoaded',init);
