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
