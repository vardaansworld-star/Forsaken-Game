'use strict';

const DOOR_LOCK_LINES=['it will not be open.','swollen shut in its frame.','locked, though there is no keyhole','something leans against it, from the other side'];

const ROOMS={
    entrance:{
        name:'The Entrance Hall',
        variantKey(){const v=STATE.rooms.entrance.visits;return v>=2?'four':'three';},
        build(ctx,rng,variant){
            drawBase(ctx,rng,{});

            furnitureBlock(ctx,1200,420,190,'panel');
            furnitureBlock(ctx,1200,300,260,'shelf');

            ctx.strokeStyle='rgba(165,135,90,0.4)';ctx.lineWidth=3;
            ctx.beginPath();ctx.moveTo(1200,4);ctx.lineTo(1200,80);
            ctx.moveTo(1140,30);ctx.lineTo(1260,30); ctx.stroke();

            const count=variant==='four'?4:3;
            const startX=650,gap=180;
            for(let i=0;i<count;i++){
                portraitShape(ctx,startX+i*gap,120,110,150,i===count-1&&count===4?'front':'side');
            }

            furnitureBlock(ctx,2100,90,260,'panel');
            ctx.strokeStyle='rgba(236,203,140,0.6)';ctx.lineWidth=2;
            ctx.beginPath();ctx.arc(2100,HORIZON-220,34,0,Math.PI*2);ctx.stroke();

            furnitureBlock(ctx,1950,20,160,'panel');

            doorShape(ctx,380,150,300,{});
            doorShape(ctx,2280,150,300,{});
            doorShape(ctx,1650,140,260,{fill:'#100906'});
            doorShape(ctx,80,170,320,{fill:'#221812'});
        },
        hotspots(variant){
            return[
                {sceneX:80,label:'the front door',type:'jumpscare'},
                {sceneX:380,label:'library',type:'door',target:'library'},
                {sceneX:750,label:'the portraits',type:'flavor',text:variant==='four'
                    ? "There are four now.The fourth is unfinished - a shape,not yeta face, It is looking at where you are standing, not where you were."
                    :"Three portraits watch the staircase.A man,a woman, a house that is not this one",discovery:variant==='four'?'fourth_portrait':null},
                {sceneX:1050,label:'the coat rack',type:'flavor',text:"A single coat still hangs here, cut for someone taller than any visitor should be."},
                {sceneX:1200,label:'upstairs',type:'door',target:'upstairs'},
                {sceneX:1650,label:'the cellar door',type:'door',target:'basement'},
                {sceneX:2100,label:'the clock',type:'flavor',text:"The hands read fourteen minutes past three.They have read fourteen minutes past three since you arrived."},
                {sceneX:2280,label:'living room',type:'door',target:'livingRoom'}
            ];
        },
        onEnter(){Audio1.startClock();},
        onLeave(){Audio1.stopClock();}
    },
    livingRoom:{
        name:'The Living Room',
        variantKey(){const v=STATE.rooms.livingRoom.visits;if(v<=1) return 'normal';if (v===2)return 'missing';return 'facing';},
        build(ctx,rng,variant){
            drawBase(ctx,rng,{wallTop:'#221a15',wallBot:'#110c09'});
            furnitureBlock(ctx,500,360,150,'soft');
            furnitureBlock(ctx,850,220,260,'panel');
            furnitureBlock(ctx,1150,160,130,'panel');
            furnitureBlock(ctx,1450,220,220,'shelf');
            if(variant==='missing'){
                ctx.strokeStyle='rgba(165,135,90,0.35)';ctx.lineWidth=3;
                ctx.strokeRect(1750-55,150,110,140);
            }else{
                portraitShape(ctx,1750,150,110,140,variant==='facing'?'front':'side');
            }
            furnitureBlock(ctx,2050,200,180,'panel');
            windowShape(ctx,2300,260,300);
            doorShape(ctx,100,150,300,{});
        },
        hotspots(variant){
            return[
                {sceneX:100,label:'entrance hall',type:'door',target:'entrance'},
                {sceneX:500,label:'the sofa',type:'flavor',text:"The cushions still hold an impression, as though someone rose from it only a moment ago."},
                {sceneX:850,label:'the fireplace',type:'flavor',text:"Cold ash. It has been cold for a very long time."},
                {sceneX:1150,label:'the television',type:'flavor',text:"the screen is dark.It bwas never plugged into anything, and yet you feel it was recently on."},
                {sceneX:1450,label:'the bookshelf',type:'flavor',text:"Spines with no title. Someone removed the lettering, or never wrote it."},
                {sceneX:1750,label:'the photograph',type:'flavor',discovery:variant==='facing'?'facing_photo':null,text:variant=='normal' ? "A family,arraged for the camera the way families are. Nobody in the frame is smiling."
                    :variant==='missing' ? "The frame is empty. Even the dust has kept its shape."
                    :"The photograph has returned. But the man who once stood in profile is now facing the camera directly. He was not, before."},
                {sceneX:2050,label:'the cabinet',type:'flavor',text:"Locked. A key-shaped patch of clean wood suggest one hung here once."},
                {sceneX:2300,label:'the window',type:'flavor',text:"The glass fronts a garden that no longer exists in any season you recognise."}
            ];
        }
    },
    library:{
        name:'The Library',
        variantKey(){const v=STATE.rooms.library.visits; return 'd'+Math.min(v,4); },
        diaryEntries:[
            "The Marlowes left in September,or so the solicitor tells me.I have found no train tickets, no packed trunks -only rooms exactly as they must have stood,waiting",
            "I catalogued the portraits again today. There were nine,and there are now ten.I did not commission a tenth.I have begun sleeping with the ledger under my pillow,as though a number could keep watch",
            "Someone rearranges the dust each night into shapes that resemble footprints leading toward rooms I have not yet opened.I no longer check whether they lead away as well.",
            "I am no longer writing to remember.I am writing so that whoever finds this after me will know that I noticed,before the house decided that I hadn't"
        ],
        build(ctx,rng){
            drawBase(ctx,rng,{wallTop:'#1c1710',wallBot:'#0f0b07'});
            furnitureBlock(ctx,450,260,320,'shelf');
            furnitureBlock(ctx,800,240,140,'panel');
            furnitureBlock(ctx,1450,120,90,'panel');
            furnitureBlock(ctx,1750,200,160,'panel');
            windowShape(ctx,2100,220,260);
            furnitureBlock(ctx,2350,260,320,'shelf');
            doorShape(ctx,100,150,300,{});
        },
        hotspots(variant){
            const idx=Math.min(STATE.rooms.library.visits,4)-1;
            const entry=ROOMS.library.diaryEntries[Math.min(Math.max(idx,0),3)];
            const disc=idx>=2 ? 'diary_change':null;
            return[
                {sceneX:100,label:'entrance hall',type:'door',target:'entrance'},
                {sceneX:450,label:'the bookshelves',type:'flavor',text:"Rows of leather spines.A few titles repeat themselves, over and over, down the shelf."},
                {sceneX:800,label:'the desk',type:'flavor',text:"A half-finished letter on the typewritter, addressed to no one,dated a year that has not happened yet."},
                {sceneX:1150,label:'the diary',type:'flavor',discovery:disc,text:entry},
                {sceneX:1450,label:'the candle',type:'flavor',text:"Still lit. It has been still lit fgor twenty-seven years."},
                {sceneX:1750,label:'the locked cabinet',type:'jumpscare'},
                {sceneX:2100,label:'the window',type:'flavor',text:"Fog presses against the glass from the inside."},
                {sceneX:2350,label:'a warm book',type:'flavor',text:"One volume is warm to be touch. Yoiu choose not to open it."}
            ];
        }
    },
    upstairs:{
        name:'The Upstairs Hallway',
        variantKey(){
            const v=STATE.rooms.upstairs.visits;
            const count=v<=1?5: v==2?4 : 6;
            return 'c'+count;
        },
        build(ctx,rng,variant){
            drawBase(ctx,rng,{wallTop:'#1a140f',wallBot:'#0c0906'});
            const count=parseInt(variant.slice(1),10);
            const startX=430, endX=2100;
            for(let i=0;i<count;i++){
                const x=startX+(endX-startX)*(i/(count-1));
                doorShape(ctx,x,130,220,{});
            }
            doorShape(ctx,100,150,260,{});
            doorShape(ctx,2360,150,260,{ajar:true});
        },
        hotspots(variant){
            const count=parseInt(variant.slice(1),10);
            const startX=430, endX=2100;
            const rng=rngFor('upstairs-doors-'+variant);
            const trapIdx=Math.floor(rng()*count);
            const hs=[
                {sceneX:100,label:'the stairs down',type:'door',target:'entrance'},
                {sceneX:2360,label:'a door, slightly ajar',type:'door',target:'bedroom'}
            ];
            for(let i=0;i<count;i++){
                const x=startX+(endX-startX)*(i/(count-1));
                if(i===trapIdx){
                    hs.push({sceneX:x,label:'a door',type:'jumpscare'});
                }else{
                    hs.push({sceneX:x,label:'a door',type:'flavor',text:pick(rng,DOOR_LOCK_LINES)});
                }
            }
            return hs;
        },
        onEnter(){
            const v=STATE.rooms.upstairs.visits;
            if(STATE._lastUpstairsCount && v>1){
                UI.caption("wait - wasn't there a different number of doors here?");
            }
            const count=v<=1?5:v===2?4:6;
            STATE._lastUpstairsCount=count;
            if(count===6) Game.discover('door_count');
        }
    },

    bedroom:{
        name:'A Bedroom',
        variantKey(){const v=STATE.rooms.bedroom.visits; return v<=1?'normal':v===2?'delay':'facing';},
        build(ctx,rng,variant){
            drawBase(ctx,rng,{wallTop:'#1f1712',wallBot:'#0e0a07'});
            furnitureBlock(ctx,450,360,160,'soft');
            furnitureBlock(ctx,900,220,300,'panel');

            ctx.strokeStyle='rgba(165,135,90,0.5)';ctx.lineWidth=6;
            ctx.strokeRect(1300-90,HORIZON-260,180,240);
            ctx.fillStyle='rgba(120,150,160,0.10)';
            ctx.fillRect(1300-84,HORIZON-254,168,228);
            furnitureBlock(ctx,1700,200,130,'panel');
            windowShape(ctx,2100,220,260);
            doorShape(ctx,100,150,280,{});
        },
        hotspots(variant){
            let mirrorText="The mirror shpes the room, plainly,the way mirros do.";
            let disc=null;
            if (variant==='delay') mirrorText="The reflection catches up to you half a second late, as thougfh it had to remember how to move first.";
            if(variant==='facing'){mirrorText="You are facing the door. In the glass, you are not.";disc='mirror_anomaly';
                const rng=rngFor('mirror-fog='+STATE.rooms.bedroom.visits);
                if(rng()<0.6) mirrorText+="Something has beed written in the fog of the glass: DON'T TURN AROUND."
            }
            return[
                {sceneX:100,label:'the hallway',type:'door',target:'upstairs'},
                {sceneX:450,label:'the bed',type:'flavor',text:"Made, a yet the pillow is dented as though someone lay here very recently."},
                {sceneX:900,label:'the wardrobe',type:'flavor',action:'wardrobe',text:"A child's clothes,decades out of fashion,still hung with care"},
                {sceneX:1300,label:'the mirror',type:'flavor',discovery:disc,text:mirrorText,mirror:true},
                {sceneX:1700,label:'the toys',type:'flavor',text:"Wooden tyoys,arranged in a circle,facing inward."},
                {sceneX:2100,label:'the window',type:'flavor',text:"From here you can see the whole of grounds.There is a figure at the tree line. There is no figure at the tree line."}
            ];
        },
        onEnter(){
            STATE._lookingAtWardrobe=false
            Game.scheduleBedroom();
        },
        onLeave(){Audio1.stopBreathing();clearBedroomTimers();}
    },
    basement:{
        name:'The Basement',
        variantKey(){return 'default';},
        build(ctx,rng){
            drawBase(ctx,rng,{wallTop:'#12160f',wallBot:'#07090a',floorTop:'#0a0d0b',floorBot:'#040504'});
            furnitureBlock(ctx,500,300,220,'machine');
            furnitureBlock(ctx,850,80,260,'panel');
            furnitureBlock(ctx,1200,180,140,'panel');
            furnitureBlock(ctx,1600,220,180,'machine');
            ctx.strokeStyle='rgba(90,150,120,0.35)';ctx.lineWidth=3;
            ctx.strokeRect(1600-90,HORIZON-150,180,110);
            ctx.fillStyle='rgba(60,110,90,0.12)';ctx.fillRect(1600-84,HORIZON-144,168,98);
            furnitureBlock(ctx,1950,240,150,'panel');   
            furnitureBlock(ctx,2250,60,220,'panel');
            doorShape(ctx,100,150,260,{});
        },
        hotspots(){
            return[
                {sceneX:100,label:'the stairs up',type:'door',target:'entrance'},
                {sceneX:500,label:'old machinery',type:'flavor',text:"Old machinery, the purpose of which you would rather not to determine."},
                {sceneX:850,label:'the pipes',type:'flavor',text:"Warm, for pipes that should carry nothing anymore."},
                {sceneX:1200,label:'the documents',type:'flavor',text:"Property records,water-stained.Asingle line survives damage: '...the family did not leave. The house simply stopped listing them.'"},
                {sceneX:1600,label:'the monitor',type:'action',action:'reveal',text:null},
                {sceneX:1950,label:'stacked furniture',type:'flavor',text:"Furniture stacked against the far wall, as if to varricade something, or someone,in."},
                {sceneX:2250,label:'the damp wall',type:'flavor',text:"The mould has grown in a pattern that resembles hardwriting.You decide not to read it."}
            ];
        }
    }
};

const ANOMALY_CHANCE={entrance:0.15,livingRoom:0.20,library:0.25,upstairs:0.30,bedroom:0.35,basement:0.5};
const RANDOM_FLAVOR=[
    "Something shifts,just out a view",
    "You could swear that chair faced the other way.",
    "A draft moves through a room with no open windoes.",
    "For a moment,you shadow does not match your movement",
    "The silence changes texture,as if something listening to it too."
]