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