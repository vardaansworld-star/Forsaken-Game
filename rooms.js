'use strict';

const DOOR_LOCK_LINES=['it will not be open.','sswollen shut in its frame.','locked, though there is no keyhole','something leans against it, from the other side'];

const ROOMS={
    entrance:{
        name:'The Enterance Hall',
        variantKey(){const v=STATE.rooms.entrance.visits;return v>=2?'four':'three';},
        build(ctx,rng,variant){
            drawBase(ctx,rng,{});

            furnitureBlock(ctx,1200,420,190,'panel');
            furnitureBlock(ctx,1200,300,260,'shelf');

            ctx.strokeStyle='rgba(165,135,90,0.4)';ctx.lineWidth=3;
            ctx.beginPath();ctx,moveTo(1200,4);ctx.lineTo(1200,80);
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
        hotspots(varuiant){
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
                ctx,strokeStyle='rgba(165,135,90,0.35)';ctx.lineWidth=3;
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
                {sceneX:100,label:'enterance hall',type:'door',target:'enterance'},
                {sceneX:500,label:'the sofa',type:'flavor',text:"The cushions still hold an impression, as though someone rose from it only a moment ago."},
                {sceneX:850,label:'the fireplace',type:'flavor',text:"Cold ash. It has been cold for a very long time."},
                {sceneX:1150,label:'the television',type:'flavor',text:"the screen is dark.It bwas never plugged into anything, and yet you feel it was recently on."},
                {sceneX:1450,label:'the bookshelf',type:'flavor',text:"Spines with no title. Someone removed the lettering, or never wrote it."},
                {sceneX:1750,label:'the photograph',type:'flavor',discovery:variant==='facing'?'facing_photo':null,text:variant=='normal' ? "A family,arraged for the camera the way families are. Nobody in the frame is smiling."
                    :variant==='mising' ? "The frame is empty. Even the dust has kept its shape."
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
            const idx=Math.min(STATE,room.library.visits,4)-1;
            const entry=ROOMS.library.diaryEnteries[Math.min(Math.max(idx,0),3)];
            const disc=idx>=2 ? 'diary_change':null;
            return[
                {sceneX:100,label:'enterance hall',type:'door',target:'entrance'},
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
    
}