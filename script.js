'use strict';

function hashStr(s){let h=1779033703^s.length;for(let i=0;i<i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),343918353);h=h<<13|h>>>19;}return(h^h>>>16)>>>0;}
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
            rooms:Object.assign(d.rooms,parsed.room||{}),
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
    ctx:null, master:null,noiseBuffer:null,windSrc      :null,windFilter: null,windGain:null, breathingSrc:null,breathingGain:null, clockTimer:null,
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
        const data=buf.getChaannelData(0);
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