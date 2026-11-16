(() => {
  "use strict";
  const canvas = document.getElementById("film-canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const screen = document.getElementById("film-screen");
  const PHOTO_SOURCE = "assets/reference-architecture.png";
  const photo = new Image();
  photo.src = PHOTO_SOURCE;
  const C = {paper:"#f3f3ed",ink:"#23372c",green:"#1c523b",muted:"#718367",line:"#ccd6bf",pale:"#e6eddc",lime:"#cfe397",dark:"#1e3d2d",white:"#f7faee"};
  const FONT = '"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
  let W=1600, H=900, portrait=false, lastTime=5.5, pixelWidth=0, pixelHeight=0;
  const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
  const lerp=(a,b,p)=>a+(b-a)*p;
  const ease=x=>1-Math.pow(1-clamp(x),3);
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
  const enter=(t,delay=0,duration=.9)=>ease((t-delay)/duration);
  const pathCache={};
  const paths={
    chat:"M20 11.5a8 8 0 0 1-8.5 8H8l-5 2 1.5-5A8.5 8.5 0 1 1 20 11.5ZM8 9h7M8 13h4",
    light:"M9 18h6m-5 4h4m-4-4a6 6 0 0 0-2-4 6 6 0 1 1 8 0 6 6 0 0 0-2 4",
    book:"M12 6v15M3 4c3-1 6 0 9 2 3-2 6-3 9-2v15c-3-1-6 0-9 2-3-2-6-3-9-2Z",
    file:"M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8m-8 4h5",
    image:"M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM3 18l6-6 4 4 3-3 5 5M9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 1 1 3 0",
    film:"M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 3v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4",
    list:"M3 6l2 2 3-4m3 2h10M3 13h4m4 0h10M3 20h4m4 0h10",
    history:"M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2",
    link:"M10 14l4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1",
    folder:"M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7ZM3 9h18",
    cloud:"M6 18a4.5 4.5 0 0 1-.5-9 6.5 6.5 0 0 1 12.5-1A5 5 0 0 1 18 18Z",
    spark:"M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4",
    search:"M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 1 1 13 0ZM16 16l5 5",
    server:"M5 3h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM5 13h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2ZM7 7h.1M7 17h.1M11 7h6m-6 10h6",
    arrow:"M4 12h16m-6-6 6 6-6 6",
    check:"M5 12l4 4L19 6",
    shield:"M12 2l8 3v7c0 6-8 10-8 10S4 18 4 12V5ZM8 12l3 3 5-6"
  };
  function font(size,weight=400,family=FONT){ctx.font=weight+" "+size+"px "+family}
  function text(value,x,y,size=24,color=C.ink,weight=400,align="left",family=FONT){
    font(size,weight,family);ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline="top";ctx.fillText(value,x,y);
  }
  function lines(values,x,y,size=24,color=C.ink,weight=400,lineHeight=1.55,align="left"){
    values.forEach((v,i)=>text(v,x,y+i*size*lineHeight,size,color,weight,align));
  }
  function paragraph(value,x,y,maxWidth,size=24,color=C.muted,lineHeight=1.8,weight=400){
    font(size,weight);let line="",row=0;
    for(const char of value){if(char==="\n"||(ctx.measureText(line+char).width>maxWidth&&line)){text(line,x,y+row*size*lineHeight,size,color,weight);row++;line=char==="\n"?"":char}else line+=char}
    if(line)text(line,x,y+row*size*lineHeight,size,color,weight);
    return (row+1)*size*lineHeight;
  }
  function rr(x,y,w,h,r=15,fill=C.white,stroke=null,lw=1){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}
  }
  function line(x1,y1,x2,y2,color=C.line,lw=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke()}
  function circle(x,y,r,fill=null,stroke=null,lw=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
  function icon(name,x,y,size=34,color=C.green,lw=1.6){
    if(!paths[name])return;pathCache[name]??=new Path2D(paths[name]);
    ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke(pathCache[name]);ctx.restore();
  }
  function group(alpha,dx,dy,draw,scale=1,cx=0,cy=0,rotation=0){
    if(alpha<=0)return;ctx.save();ctx.globalAlpha*=clamp(alpha);ctx.translate(dx,dy);ctx.translate(cx,cy);ctx.rotate(rotation);ctx.scale(scale,scale);ctx.translate(-cx,-cy);draw();ctx.restore();
  }
  function reveal(t,delay,draw,dy=32,duration=.9){
    const p=enter(t,delay,duration);group(p,0,(1-p)*dy,draw);
  }
  function photoCrop(x,y,w,h,r=12){
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();
    if(photo.complete&&photo.naturalWidth){const sw=photo.naturalWidth,sh=photo.naturalHeight;const scale=Math.max(w/sw,h/sh);ctx.drawImage(photo,x+(w-sw*scale)/2,y+(h-sh*scale)/2,sw*scale,sh*scale)}
    else{ctx.fillStyle="#8d9585";ctx.fillRect(x,y,w,h)}
    ctx.restore();
  }
  function shadow(draw,color="#203a2620",blur=40,dy=18){ctx.save();ctx.shadowColor=color;ctx.shadowBlur=blur;ctx.shadowOffsetY=dy;draw();ctx.restore()}
  function background(dark,t=0){
    ctx.fillStyle=dark?C.dark:C.paper;ctx.fillRect(0,0,W,H);
    const grad=ctx.createRadialGradient(W*.85,H*.25,0,W*.6,H*.5,W*.7);
    grad.addColorStop(0,dark?"#3e604b55":"#dbe6ce65");grad.addColorStop(1,dark?"#1e3d2d00":"#f3f3ed00");
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=dark?.12:.15;ctx.fillStyle=dark?"#a5c08b":"#a4b494";
    for(let x=portrait?30:44;x<W;x+=38)for(let y=35;y<H;y+=38)if(x>W*.44||y>H*.72)ctx.fillRect(x,y,1.1,1.1);
    ctx.restore();
  }
  function head(index,label,dark=false){
    const m=portrait?60:70,fg=dark?"#b5c99c":"#6e825e",fs=portrait?17:14;
    text("项目设想  /  概念示意",m,portrait?48:42,fs,fg);
    text(String(index+1).padStart(2,"0")+" / 16",W-m,portrait?48:42,fs,dark?"#739269":"#9baa8a",400,"right","Consolas,monospace");
    line(m,portrait?90:78,W-m,portrait?90:78,dark?"#4a6341":"#d3dcc8");
    if(label)text(label,m,portrait?119:108,portrait?17:14,fg);
  }
  function subtitle(values,dark=false){
    if(typeof values==="string")values=[values];
    const size=portrait?25:22;
    lines(values,W/2,H-(portrait?115:90),size,dark?"#c2d2ad":"#6f825d",400,1.65,"center");
  }
  function dotLine(points,progress,color="#9bb981",width=1.8){
    const seg=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));let remaining=seg.reduce((a,b)=>a+b,0)*clamp(progress);
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...points[0]);
    for(let i=0;i<seg.length;i++){const p=clamp(remaining/seg[i]);ctx.lineTo(lerp(points[i][0],points[i+1][0],p),lerp(points[i][1],points[i+1][1],p));remaining-=seg[i];if(remaining<=0)break}ctx.stroke();
  }
  function packet(points,t,color=C.lime){
    const seg=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));let dist=(t%1)*seg.reduce((a,b)=>a+b,0);
    for(let i=0;i<seg.length;i++){if(dist<=seg[i]){const p=dist/seg[i];circle(lerp(points[i][0],points[i+1][0],p),lerp(points[i][1],points[i+1][1],p),3.5,color);break}dist-=seg[i]}
  }
  function smallCard(x,y,w,h,type,title,detail="",rotation=0,t=0){
    group(1,0,Math.sin(t*.65+x*.01)*4,()=>{
      shadow(()=>rr(x,y,w,h,16,C.white,"#d9e2cd"));
      rr(x+20,y+22,42,45,10,C.pale);icon(type,x+28,y+31,26,"#6d8b54");
      text(title,x+80,y+24,22,C.ink,500);
      if(detail)text(detail,x+80,y+58,15,"#8b9b7b");
    },1,x+w/2,y+h/2,rotation);
  }
  function miniChat(x,y,w,h,t=0,dark=false){
    shadow(()=>rr(x,y,w,h,18,C.white,"#d6e0c8"),"#0d241d25",35,20);
    rr(x+18,y+18,34,34,10,C.pale);icon("chat",x+24,y+24,22);
    text("给自己",x+65,y+20,18,C.ink,500);text("我的聊天记录",x+65,y+46,11,"#94a183");
    line(x+15,y+72,x+w-15,y+72,"#e1e7d8");
    let yy=y+94;
    ["想看《布达佩斯大饭店》","明早给老师发邮件"].forEach((s,i)=>{const bw=Math.min(w-46,i?175:230);rr(x+w-bw-20,yy,bw,36,9,C.pale);text(s,x+w-bw-7,yy+10,i?12:11,"#4e6b3c");yy+=49});
    const ph=Math.min(h*.27,150),pw=ph*1.16;photoCrop(x+w-pw-24,yy,pw,ph,7);yy+=ph+14;
    if(yy+35<y+h-50){rr(x+w-220,yy,200,33,9,C.pale);text("今天终于把实验跑通了",x+w-208,yy+10,11,"#4e6b3c")}
    rr(x+15,y+h-42,w-30,27,7,"#edf2e6");text("给自己发消息…",x+26,y+h-36,10,"#9ba98e");
  }

  const purposes=[["light","灵感创意"],["book","学习工作"],["file","文案与稿件"],["image","审美积累"],["film","书影音清单"],["history","生活回顾"],["list","待办与日程"],["link","网页收藏"],["folder","文件传输"]];
  const results=[["film","书单影单番单"],["list","待办与提醒"],["image","审美素材库"],["book","学习与笔记"],["history","生活回顾"],["search","智能检索"]];
  function sceneTitle(t){
    background(false,t);head(0,"一段关于记录、保存与整理的设想");
    const x=portrait?65:115, y=portrait?205:240, fs=portrait?71:84;
    reveal(t,.1,()=>{rr(x,y-66,44,44,13,C.green);icon("chat",x+9,y-57,26,C.white);text("一个项目设想",x+60,y-56,21,"#6b8259",400)});
    reveal(t,.45,()=>lines(["一个只和自己","聊天的 App。"],x,y,fs,C.ink,600,1.35),70,1.1);
    reveal(t,1.4,()=>lines(portrait?["一个纯粹而且足够好用的","「文件传输助手」。"]:["一个纯粹而且足够好用的「文件传输助手」。"],x,y+fs*2.95,portrait?26:25,"#7a896d",400,1.75));
    const mx=portrait?365:1115,my=portrait?685:400,mw=portrait?310:350,mh=portrait?350:485;
    const p=enter(t,.9,1.4);
    group(p,0,(1-p)*70,()=>{
      ctx.save();ctx.strokeStyle="#d0dcc2";ctx.lineWidth=1;
      for(const r of [235,305]){ctx.beginPath();ctx.ellipse(mx+mw/2,my+mh/2,r,r*.9,-.22,0,Math.PI*2);ctx.stroke()}ctx.restore();
      group(1,0,0,()=>miniChat(mx-mw/2,my-75,mw,mh,t),1,mx,my+100,-.06+Math.sin(t*.25)*.012);
      if(portrait){smallCard(100,780,340,100,"file","讲稿_v3.pdf","PDF · 1.8 MB",-.08,t)}
      else{smallCard(1200,295,315,105,"file","讲稿_v3.pdf","PDF · 1.8 MB",.07,t);group(1,0,0,()=>{shadow(()=>rr(815,610,290,118,15,C.white,"#d9e2cd"));text("随手记下的单词",838,629,12,"#9aa58a");text("serendipity",838,654,39,C.ink,400,"left","Georgia,serif");text("偶然发现美好事物的机缘",838,701,12,"#8c9d77")},1,960,668,-.07)}
    });
  }
  function sceneOrigin(t){
    background(false,t);head(1,"灵感来源");
    const x=portrait?65:110, y=portrait?195:185, fs=portrait?57:66;
    reveal(t,.1,()=>lines(["文件传输助手，","早已不止是","文件传输助手。"],x,y,fs,C.ink,600,1.32));
    const story=t<8?"我现在经常使用微信的文件传输助手，或者直接给自己的 QQ 账号发消息。":t<16?"除了在不同设备之间传文字和文件，我还会把突然想到的灵感、学习工作中的记录、生活中需要记住的事情发进去。":"偶尔也会在里面写文案、写和看面试或 Presentation 的稿子，甚至顺手记下不认识的单词。";
    reveal(t,.9,()=>paragraph(story,x,y+fs*4.4,portrait?720:620,portrait?27:25,C.muted,1.95),25);
    if(portrait){
      reveal(t,1.8,()=>smallCard(115,670,655,105,"film","想看《布达佩斯大饭店》","书影音清单",.025,t));
      reveal(t,3.1,()=>smallCard(80,810,520,105,"file","讲稿_v3.pdf","PDF · 1.8 MB",-.045,t));
      reveal(t,4.7,()=>{group(1,0,0,()=>{rr(575,825,225,220,16,C.white,"#d8e0cb");photoCrop(585,835,205,200,10)},1,680,920,.055)});
      reveal(t,6.2,()=>{text("serendipity",130,965,44,C.green,400,"left","Georgia,serif");text("偶然发现美好事物的机缘",132,1021,20,"#859672")});
    }else{
      reveal(t,1.8,()=>smallCard(850,190,590,110,"film","想看《布达佩斯大饭店》","书影音清单",.035,t));
      reveal(t,3.1,()=>smallCard(925,350,480,110,"file","讲稿_v3.pdf","PDF · 1.8 MB",-.04,t));
      reveal(t,4.7,()=>{group(1,0,0,()=>{shadow(()=>rr(1215,505,235,230,16,C.white,"#d8e0cb"));photoCrop(1225,515,215,210,10)},1,1330,620,.055)});
      reveal(t,6.2,()=>{text("serendipity",845,570,57,C.green,400,"left","Georgia,serif");text("偶然发现美好事物的机缘",850,645,22,"#859672")});
    }
    reveal(t,4,()=>subtitle(["文件传输助手，早已不止是文件传输助手。"]));
  }
  function drawDevice(x,y,w,h,name,type="desktop",accent=false){
    const fill=accent?"#e5edd8":"#f9faf4",stroke=accent?"#9cb889":"#c9d7bb";
    if(type==="phone"){rr(x+w*.34,y,w*.32,h,14,fill,stroke,2);line(x+w*.44,y+10,x+w*.55,y+10,stroke,2);for(let i=0;i<3;i++)rr(x+w*.38,y+42+i*23,w*.23,13,4,"#d5e3c7")}
    else{rr(x,y,w,h-22,12,fill,stroke,2);rr(x+14,y+15,w-28,h-54,5,"#ecf1e5");for(let i=0;i<3;i++){rr(x+w*.3,y+32+i*28,w*.55,18,5,i===1?"#c3d5ad":"#d9e5cd")}if(type==="laptop"){ctx.beginPath();ctx.moveTo(x-14,y+h-23);ctx.lineTo(x+w+14,y+h-23);ctx.lineTo(x+w+1,y+h-9);ctx.lineTo(x-1,y+h-9);ctx.closePath();ctx.fillStyle="#ccd9bd";ctx.fill()}else{line(x+w*.5,y+h-22,x+w*.5,y+h+10,stroke,4);line(x+w*.3,y+h+12,x+w*.7,y+h+12,stroke,3)}}
    if(name)text(name,x+w/2,y+h+35,portrait?24:20,"#71865f",400,"center");
  }
  function sceneNeed(t){
    background(false,t);head(3,"为什么想自己做一个");
    reveal(t,.1,()=>lines(portrait?["我希望所有消息和文件，","都能长期保存在云端。"]:["我希望所有消息和文件","都能长期保存在云端。"],portrait?65:110,portrait?195:175,portrait?52:64,C.ink,600,1.38));
    const dy=portrait?610:440,dw=portrait?210:290,dh=portrait?165:190;
    const xs=portrait?[65,345,625]:[235,655,1075];
    xs.forEach((x,i)=>reveal(t,1.1+i*.65,()=>drawDevice(x,dy,dw,dh,["macOS","Windows","Linux"][i],i===1?"laptop":"desktop",i===1)));
    const cp=enter(t,3.1,1.2);
    for(let i=0;i<2;i++){const a=xs[i]+dw,b=xs[i+1];dotLine([[a,dy+80],[b,dy+80]],cp,"#a1b88d",2);if(t>4.4)packet([[a,dy+80],[b,dy+80]],t*.4+i*.5,"#7ea163")}
    reveal(t,4.2,()=>{icon("cloud",W/2-24,portrait?895:366,48,"#6f9751");text("完整的历史记录",W/2,portrait?968:716,portrait?28:23,C.green,400,"center")});
    reveal(t,1.9,()=>subtitle(t<6?["常用聊天软件不方便多台电脑同时登录，只能来回切换。"]:t<11?["换了设备，也能找回完整的历史记录。"]:t<15?["消息多了难免杂乱，正好可以交给 AI 帮忙整理。"]:["既然现有软件不能完全满足这些需求，干脆自己做一个好了。"]));
  }
  function scenePurposes(t){
    background(false,t);head(4,"核心理念");
    reveal(t,.1,()=>{text("多种用途，一个聊天入口。",W/2,portrait?195:157,portrait?49:60,C.ink,600,"center")});
    const bw=portrait?238:310,bh=portrait?145:114,gap=portrait?18:22;
    const total=bw*3+gap*2,x0=(W-total)/2,y0=portrait?375:278;
    const gather=smooth((t-10)/3.2),cx=W/2,cy=portrait?650:470;
    purposes.forEach(([name,label],i)=>{
      const x=x0+(i%3)*(bw+gap),y=y0+Math.floor(i/3)*(bh+gap),p=enter(t,.5+i*.16,.8);
      const xx=lerp(x,cx-bw/2,gather),yy=lerp(y,cy-bh/2,gather);
      group(p*(1-gather*.93),0,(1-p)*25,()=>{
        shadow(()=>rr(xx,yy,bw,bh,17,C.white,"#d7e2c8"),"#41632d0b",16,5);
        icon(name,xx+bw/2-17,yy+(portrait?30:22),34,"#6b8e52");text(label,xx+bw/2,yy+(portrait?89:73),portrait?25:23,"#4b653d",400,"center");
      },1-gather*.65,xx+bw/2,yy+bh/2);
    });
    const ip=smooth((gather-.2)/.6);
    group(ip,0,(1-ip)*30,()=>{rr(cx-68,cy-68,136,136,37,C.green);icon("chat",cx-39,cy-39,78,C.white);text("给自己发消息",cx,cy+103,portrait?36:32,C.green,500,"center")},.8+ip*.2,cx,cy);
    reveal(t,2.5,()=>subtitle(["不需要提前分类，直接发送。"]));
  }
  const messageDelays=[1,3,5,7,9,11,13,15,17];
  function fullChat(x,y,w,t){
    const s=portrait?1.18:1,h=720*s;
    shadow(()=>rr(x,y,w,h,20,C.white,"#cfddbf"),"#2545231c",40,20);
    const pad=22*s;rr(x+pad,y+18*s,40*s,40*s,12*s,C.pale);icon("chat",x+pad+8*s,y+26*s,25*s);
    text("给自己发消息",x+pad+55*s,y+17*s,21*s,C.ink,600);text("我的聊天记录",x+pad+55*s,y+45*s,13*s,"#92a27e");
    text("概念示意",x+w-pad,y+26*s,12*s,"#94a780",400,"right");line(x+pad,y+77*s,x+w-pad,y+77*s,"#e0e7d5");
    const items=[
      {text:"想看《布达佩斯大饭店》",h:34,w:300},
      {text:"明早给老师发邮件",h:34,w:236},
      {lines:["各位老师好，我今天汇报的题目是……","首先介绍一下课题的研究背景……"],h:55,w:435},
      {file:"讲稿_v3.pdf",detail:"PDF · 1.8 MB",h:48,w:228,type:"file"},
      {photo:true,h:104,w:174},
      {text:"想补《冰菓》",h:34,w:182},
      {word:true,h:48,w:350},
      {text:"今天终于把实验跑通了",h:34,w:280},
      {file:"project-files.zip",detail:"128 MB",h:48,w:256,type:"folder"}
    ];
    if(portrait){
      const dimensions=[[600,58],[510,58],[660,104],[430,80],[270,170],[350,58],[595,88],[610,58],[470,80]];
      items.forEach((item,i)=>{item.w=dimensions[i][0]/s;item.h=dimensions[i][1]/s});
    }
    const gap=portrait?12:8*s;
    const visibleHeight=items.reduce((height,m,i)=>height+(m.h*s+gap)*enter(t,messageDelays[i],.65),0);
    const scroll=portrait?Math.max(0,visibleHeight-(h-155*s)):0;
    ctx.save();
    ctx.beginPath();ctx.rect(x+pad-3,y+87*s,w-pad*2+6,h-139*s);ctx.clip();ctx.translate(0,-scroll);
    let yy=y+95*s,count=0;
    items.forEach((m,i)=>{
      const p=enter(t,messageDelays[i],.65),bw=Math.min(w-pad*2,m.w*s),hh=m.h*s,xx=x+w-pad-bw;
      if(p>.8)count++;
      group(p,(1-p)*38,(1-p)*12,()=>{
        rr(xx,yy,bw,hh,10*s,m.photo?"#e8eddf":"#e5edd9");
        if(m.photo)photoCrop(xx+4*s,yy+4*s,bw-8*s,hh-8*s,7*s);
        else if(m.file){icon(m.type,xx+12*s,yy+(portrait?23:10*s),portrait?40:26*s,"#7f9a65");text(m.file,xx+(portrait?76:50*s),yy+(portrait?12:6*s),portrait?29:17*s,C.ink,500);text(m.detail,xx+(portrait?76:50*s),yy+(portrait?51:28*s),portrait?20:11*s,"#8c9e77")}
        else if(m.word){text("serendipity",xx+13*s,yy+(portrait?9:6*s),portrait?36:22*s,C.ink,400,"left","Georgia,serif");text("偶然发现美好事物的机缘",xx+13*s,yy+(portrait?56:30*s),portrait?23:11*s,"#788e63")}
        else if(m.lines)lines(m.lines,xx+13*s,yy+(portrait?15:7*s),portrait?27:15*s,"#4d663d",400,1.5);
        else text(m.text,xx+13*s,yy+(portrait?13:8*s),portrait?30:17*s,"#4d663d");
      });
      yy+=hh+gap;
    });
    ctx.restore();
    rr(x+pad,y+h-38*s,w-pad*2,24*s,6*s,"#edf2e6");text("给自己发消息…",x+pad+12*s,y+h-33*s,10*s,"#98a98a");
    canvas.dataset.messages=String(count);
  }
  function sceneChat(t){
    background(false,t);head(5,"同一个聊天入口");
    if(portrait){
      reveal(t,.1,()=>text("给自己发消息。",65,190,61,C.ink,600));
      reveal(t,.6,()=>text("我的聊天记录 · 先留下来，再慢慢整理",67,285,25,C.muted));
      reveal(t,0,()=>fullChat(90,360,720,t),35,.9);
    }else{
      reveal(t,.1,()=>lines(["想到什么，","直接发条消息。"],110,258,60,C.ink,600,1.4));
      reveal(t,1,()=>paragraph("所有信息首先作为普通消息，进入同一条时间线。",114,475,490,25,C.muted,1.95));
      reveal(t,2.2,()=>{line(115,625,173,625,"#91ac74",2);text("不需要提前判断它属于哪个分类。",115,661,19,"#8a9c77")});
      reveal(t,0,()=>fullChat(830,112,580,t),35,.9);
    }
  }
  function processNode(x,y,w,h,name,title,body,deep){
    const fg=deep?"#e5f0d2":C.ink,muted=deep?"#bacda7":"#789364";
    shadow(()=>rr(x,y,w,h,20,deep?"#416b4b":"#f2f6e8",deep?"#6e8b56":"#e2ebd4"),"#081b1420",26,15);
    rr(x+28,y+29,60,60,19,deep?"#578058":"#dfebcd");icon(name,x+41,y+42,34,deep?"#dbecbe":"#688f4f");
    text(title,x+28,y+116,portrait?32:30,fg,500);
    lines(body,x+28,y+182,portrait?24:22,muted,400,1.9);
    rr(x,y+h-5,w,5,[0,0,20,20],deep?"#a9c97e":"#bdd3a1");
  }
  function sceneProcess(t){
    background(true,t);head(6,"保存与整理",true);
    reveal(t,.1,()=>lines(["原始内容完整保存，","AI 负责理解和整理。"],portrait?60:105,portrait?180:150,portrait?52:58,"#e9f0df",600,1.4));
    if(portrait){
      reveal(t,.9,()=>{rr(70,415,760,140,18,"#2a4d36","#688953");icon("chat",105,457,49,"#c8dda7");text("原始消息与附件",180,447,29,"#d7e6c4",500);text("完整保存",182,493,22,"#93b277");photoCrop(665,432,135,105,9)});
      const paths2=[[[450,555],[450,630],[260,630],[260,690]],[[450,555],[450,630],[640,630],[640,690]]];
      paths2.forEach((p,i)=>{dotLine(p,enter(t,1.8,1.1),"#799a60");if(t>3)packet(p,t*.32+i*.4)});
      reveal(t,2.5,()=>processNode(65,690,370,350,"cloud","云端长期存储",["消息与附件","完整历史漫游","备份和恢复"],false));
      reveal(t,3.25,()=>processNode(465,690,370,350,"spark","AI 整理与归纳",["自动分类 · 信息提取","关联整理","语义检索"],true));
    }else{
      reveal(t,.8,()=>{miniChat(100,373,265,350,t,true);text("原始消息与附件",233,337,20,"#c5d9aa",400,"center")});
      const branches=[[[365,535],[480,535],[480,435],[655,435]],[[365,535],[480,535],[480,745],[1132,745],[1132,656]]];
      branches.forEach((p,i)=>{dotLine(p,enter(t,1.8,1.5),"#6f9557");if(t>3.3)packet(p,t*.26+i*.45)});
      reveal(t,2.4,()=>processNode(655,350,360,330,"cloud","云端长期存储",["消息与附件","完整历史漫游","备份和恢复"],false));
      reveal(t,3.2,()=>processNode(1095,350,360,330,"spark","AI 整理与归纳",["自动分类 · 信息提取","关联整理","语义检索"],true));
    }
    reveal(t,5.2,()=>subtitle(portrait?["整理结果单独保存，","可以修改、纠正或重新生成。"]:["整理结果单独保存，可以修改、纠正或重新生成，不影响原始消息。"],true));
  }
  function extractionCard(x,y,w,h,type,source,title,detail,t,delay){
    reveal(t,delay,()=>{
      rr(x,y,w,h,20,"#f9fbf3","#d4dfc6");
      text("原始消息",x+26,y+25,portrait?20:16,"#95a482");
      text(source,x+26,y+67,portrait?29:28,C.ink,400);
    });
    const arrowY=y+(portrait?135:145),p=enter(t,delay+1.3,.8);
    group(p,0,-(1-p)*16,()=>{ctx.save();ctx.translate(x+w/2,arrowY+15);ctx.rotate(Math.PI/2);icon("arrow",-15,-15,30,"#8eaa74");ctx.restore()});
    reveal(t,delay+2,()=>{
      const ry=y+(portrait?178:205),rh=portrait?110:130;
      rr(x+22,ry,w-44,rh,13,C.pale,"#ccdbb9");
      if(type==="list")rr(x+45,ry+34,27,27,6,null,"#8da875",2);else icon(type,x+42,ry+32,34,"#719852");
      text(title,x+99,ry+25,portrait?28:28,C.green,500);text(detail,x+100,ry+67,portrait?22:21,"#7c9664");
      text("AI 提取",x+w-40,ry+rh-27,portrait?14:12,"#96a782",400,"right");
    },28);
  }
  function sceneOrganize(t){
    background(false,t);head(7,"AI 整理的几种典型用法");
    const blend=t<11?0:1;
    group(1-blend,0,-blend*30,()=>{
      reveal(t,.1,()=>text("把普通消息，整理成信息。",W/2,portrait?205:162,portrait?46:59,C.ink,600,"center"));
      if(portrait){
        extractionCard(75,350,750,310,"film","想看《布达佩斯大饭店》","布达佩斯大饭店","电影 · 想看",t,.45);
        extractionCard(75,760,750,310,"list","明早给老师发邮件","给老师发邮件","待办 · 明早",t,.8);
      }else{
        extractionCard(125,297,635,365,"film","想看《布达佩斯大饭店》","布达佩斯大饭店","电影 · 想看",t,.4);
        extractionCard(840,297,635,365,"list","明早给老师发邮件","给老师发邮件","待办 · 明早",t,.8);
      }
      subtitle(["AI 整理的结果，应当能够追溯来源。"]);
    });
    group(blend,0,(1-blend)*38,()=>{
      text("整理后的个人信息",W/2,portrait?205:160,portrait?54:62,C.ink,600,"center");
      const bw=portrait?350:405,bh=portrait?176:157,cols=portrait?2:3,gap=portrait?24:25,x0=(W-(bw*cols+gap*(cols-1)))/2,y0=portrait?380:310;
      results.forEach(([name,label],i)=>{
        const p=enter(t,11.3+i*.18,.8),x=x0+(i%cols)*(bw+gap),y=y0+Math.floor(i/cols)*(bh+gap);
        group(p,0,(1-p)*32,()=>{shadow(()=>rr(x,y,bw,bh,18,C.white,"#d4dfc5"),"#244c2f0a",20,7);icon(name,x+30,y+35,37,"#719755");text(label,x+30,y+101,portrait?27:26,C.green,500)});
      });
      subtitle(portrait?["整理结果可以修改，","不影响原始消息。"]:["整理结果可以修改、纠正或重新生成，不影响原始消息。"]);
    });
    phaseVeil(t,11);
  }
  function sceneDevices(t){
    background(false,t);head(9,"计划中的使用形态");
    reveal(t,.1,()=>lines(["六平台客户端","与多设备同时登录"],portrait?65:110,portrait?190:170,portrait?56:60,C.ink,600,1.35));
    const names=["Windows","macOS","Linux","Android","iOS","Web"];
    const dx=portrait?250:355,dy=portrait?460:380,dw=portrait?400:470,dh=portrait?230:235;
    reveal(t,.85,()=>drawDevice(dx,dy,dw,dh,"","laptop",true));
    const bw=portrait?220:220,bh=portrait?63:60,gap=portrait?21:20,x0=portrait?100:215,y0=portrait?770:650;
    names.forEach((name,i)=>reveal(t,1.4+i*.2,()=>{const x=x0+(i%3)*(bw+gap),y=y0+Math.floor(i/3)*(bh+14);rr(x,y,bw,bh,9,"#f8faf2","#d1dec2");text(name,x+bw/2,y+19,portrait?23:20,"#5b7847",400,"center")},22));
    reveal(t,3.7,()=>{
      const x=portrait?100:1080,y=portrait?990:348,w=portrait?700:365,h=portrait?165:330;
      rr(x,y,w,h,20,C.green);
      icon("server",x+30,y+30,portrait?46:54,C.lime);
      text("自托管部署",x+(portrait?105:30),y+(portrait?32:118),portrait?32:33,"#e4edcf",500);
      text("初期计划支持",x+(portrait?107:32),y+(portrait?85:177),portrait?20:17,"#aac494");
      text("公网服务器 · VPS · NAS",x+(portrait?107:32),y+(portrait?118:230),portrait?22:21,"#c3d8ad");
    });
    if(!portrait)reveal(t,5.1,()=>{icon("shield",1078,722,24,"#819e66");text("基础安全，从第一阶段开始考虑。",1114,725,17,"#7c9566")});
    reveal(t,5.7,()=>subtitle(["同一账号体系，多台设备同时在线。"]));
  }
  const milestones=["基础消息系统与自托管","AI 整理与归纳","六平台客户端与个人信息管理","长期可靠性与安全体系研究","公开测试与官方托管"];
  function sceneRoadmap(t){
    background(true,t);head(14,"开发阶段规划",true);
    reveal(t,.1,()=>{text("一步一步，",portrait?65:110,portrait?195:205,portrait?68:71,"#e5efda",500);text("做成能长期用的样子。",portrait?65:110,portrait?294:312,portrait?53:46,"#a7c48d",400)});
    if(!portrait)reveal(t,1.1,()=>{text("01",110,455,210,"#355b3c",400,"left","Georgia,serif");text("— 05",120,680,45,"#668b54",400,"left","Georgia,serif")});
    const x=portrait?85:740,y=portrait?470:183,row=portrait?128:107;
    milestones.forEach((label,i)=>{
      const p=enter(t,.6+i*1.1,.8);
      if(i<4)dotLine([[x+22,y+i*row+50],[x+22,y+(i+1)*row]],enter(t,.7+i*1.1,1),"#557a48",1);
      group(p,(1-p)*30,0,()=>{
        circle(x+22,y+i*row+22,23,"#294b33","#6c8b56",1);
        text(String(i+1).padStart(2,"0"),x+22,y+i*row+11,19,"#b9d49b",400,"center","Consolas,monospace");
        text(label,x+67,y+i*row+7,portrait?28:26,"#d1e2bf",400);
        const detail=["消息、文件、历史、基本搜索与基础安全","分类、提取、关联、语义检索与隐私控制","离线缓存、消息漫游、预览与个人信息视图","备份恢复、完整导出、安全调研与测试","版本稳定、经过必要安全验证后，再扩大测试"];
        text(detail[i],x+67,y+i*row+47,18,"#8eae79");
        if(i<4)line(x+67,y+i*row+73,portrait?810:1480,y+i*row+73,"#3d603d");
      });
    });
    reveal(t,6.3,()=>subtitle(portrait?["阶段顺序不代表重要性的排序。","基础安全从第一阶段开始建设。"]:["阶段顺序不代表重要性的排序。基础安全从第一阶段开始建设。"],true));
  }
  function sceneEnd(t){
    background(false,t);head(15,"最后想做成的样子");
    const cx=W/2,cy=portrait?235:170,p=enter(t,.15,1);
    group(p,0,(1-p)*25,()=>{rr(cx-34,cy,68,68,20,C.green);icon("chat",cx-21,cy+13,42,C.white)});
    const yy=portrait?440:333,fs=portrait?63:73;
    reveal(t,.55,()=>lines(portrait?["一个真正能","长期用下去的","「文件传输助手」。"]:["一个真正能长期用下去的","「文件传输助手」。"],cx,yy,fs,C.ink,500,1.48,"center"),50,1.1);
    reveal(t,2,()=>text("想到什么，就直接发给自己。",cx,portrait?812:592,portrait?31:28,"#71865d",400,"center"));
    reveal(t,3.4,()=>{const yy2=portrait?950:704;line(cx-50,yy2,cx+50,yy2,"#a6be8a",1.5);text("目前仍处于项目构想阶段",cx,yy2+31,portrait?23:19,"#849c6c",400,"center");text("具体功能、技术方案与开发顺序都有调整空间。",cx,yy2+74,portrait?19:16,"#96a485",400,"center")});
  }
  function phaseVeil(t,cut,dark=false){
    const distance=Math.abs(t-cut);
    if(distance<.4){ctx.save();ctx.globalAlpha*=1-smooth(distance/.4);ctx.fillStyle=dark?C.dark:C.paper;ctx.fillRect(0,0,W,H);ctx.restore()}
  }
  function sceneMemory(t){
    background(false,t);head(2,"我和文件传输助手的故事");
    reveal(t,.1,()=>lines(["零零碎碎的消息，","也留下了生活的记录。"],110,185,59,C.ink,600,1.4));
    const story=t<8?"看到有意思的创意，或者好看的摄影、绘画、设计作品，我也会顺手发进去，积攒审美，方便以后学习模仿。":t<14?"想看的书、电影和想补的番也会记下来，免得之后忘了。这些消息还能让我在不写日记的情况下，回顾过去的日子。":"到了大四，要记住的事情越来越多，记忆力却反而下降了。也就更加依赖这种外置的记录。";
    reveal(t,.7,()=>paragraph(story,114,415,610,25,C.muted,1.95));
    reveal(t,1.1,()=>{line(870,235,870,690,"#c2d4b0",2)});
    reveal(t,1.4,()=>{circle(870,275,5,"#88a66b");smallCard(920,218,520,105,"film","想补《冰菓》","书影音清单",.02,t)});
    reveal(t,3.2,()=>{circle(870,435,5,"#88a66b");smallCard(920,380,520,105,"light","今天终于把实验跑通了","随手留下的记录",-.025,t)});
    reveal(t,5,()=>{circle(870,601,5,"#88a66b");group(1,0,0,()=>{rr(920,545,520,137,15,C.white,"#d8e1cc");text("serendipity",947,570,40,C.green,400,"left","Georgia,serif");text("偶然发现美好事物的机缘",949,628,22,"#81966d")},1,1180,600,.02)});
    reveal(t,7,()=>subtitle(["想到什么直接发条消息，总比打开笔记软件、新建文档、考虑怎么分类方便得多。"]));
  }
  function capabilityGrid(items,t,y=330,dark=false){
    const bw=430,bh=126,gap=24,x0=131;
    items.forEach((label,i)=>{
      const x=x0+(i%3)*(bw+gap),yy=y+Math.floor(i/3)*(bh+24);
      reveal(t,.8+i*.7,()=>{rr(x,yy,bw,bh,15,dark?"#2b4c34":"#f8faf2",dark?"#5b7849":"#d2dfc3");circle(x+45,yy+45,20,null,dark?"#8ba871":"#adbf99");text(String(i+1).padStart(2,"0"),x+45,yy+34,17,dark?"#b7ce9d":"#839f6a",400,"center","Consolas,monospace");text(label,x+24,yy+79,25,dark?"#d9e7c8":"#426438",500)},24);
    });
  }
  function sceneFeatures(t){
    background(false,t);head(8,"希望完善的常用操作");
    if(t<10){
      reveal(t,.1,()=>text("消息与文件传输",110,165,61,C.ink,600));
      reveal(t,.7,()=>text("文字、图片、截图、链接与各类文件。",114,260,27,C.muted));
      capabilityGrid(["截图粘贴","文件拖放","上传进度","文件预览","复制粘贴","消息搜索"],t,340);
      reveal(t,4,()=>lines(["文案、面试稿、Presentation 稿件和代码片段，","也希望提供方便的编辑、阅读和跨设备使用体验。"],800,722,23,"#7d936a",400,1.8,"center"));
      reveal(t,5,()=>text("尤其重视桌面端的输入、文件操作、系统集成和 UI 渲染质量。",800,812,20,"#879d74",400,"center"));
    }else{
      const q=t-10;
      reveal(q,.1,()=>text("完整历史漫游与长期保存",110,165,57,C.ink,600));
      reveal(q,.7,()=>text("新设备登录，找回全部历史内容，不依赖旧设备在线。",114,260,26,C.muted));
      capabilityGrid(["增量拉取","手动刷新","离线缓存","历史检索","备份恢复","完整数据导出"],q,340);
      reveal(q,3,()=>subtitle(["数据完整性优先于毫秒级即时同步。"]));
    }
    phaseVeil(t,10);
  }
  function sceneBasicSecurity(t){
    background(false,t);head(10,"身份验证、安全与隐私 / 初期");
    reveal(t,.1,()=>text("基础安全，从第一版开始。",110,162,60,C.ink,600));
    reveal(t,.7,()=>text("安全措施分阶段完善，但基础安全不会推迟到后续版本。",114,263,25,C.muted));
    capabilityGrid(["安全身份认证","HTTPS 传输加密","数据访问控制","设备与会话管理","备份与恢复","基本限流与防护"],t,338);
    reveal(t,6.2,()=>lines(["第一版应具备与实际使用范围相匹配的基本安全措施。","早期自托管版本，不等于经过全面安全审计的成熟产品。"],800,728,24,"#6a8257",400,1.85,"center"));
  }
  function privacyNode(x,title,body,type,t,delay){
    reveal(t,delay,()=>{rr(x,365,415,244,18,"#f9fbf3","#d3dfc4");icon(type,x+26,395,36,"#789a5a");text(title,x+26,458,29,C.green,500);lines(body,x+26,516,22,"#839a6b",400,1.8)},28);
  }
  function scenePrivacy(t){
    background(false,t);head(11,"AI 与隐私保护");
    if(t<12){
      reveal(t,.1,()=>text("区分数据存储与模型处理。",110,157,57,C.ink,600));
      reveal(t,.6,()=>text("AI 整理需要读取消息、文档和图片。",114,254,26,C.muted));
      privacyNode(110,"数据存储",["原始消息、文档与图片","长期保存"],"folder",t,.9);
      privacyNode(593,"知情与范围控制",["用户应知道发送了哪些数据","并能控制处理范围"],"list",t,2);
      privacyNode(1075,"模型处理",["初期：可配置模型 API","未来：也可支持自托管模型"],"spark",t,3.1);
      dotLine([[525,488],[580,488]],enter(t,2.4,1),"#9ab67e",2);
      dotLine([[1008,488],[1063,488]],enter(t,3.6,1),"#9ab67e",2);
      reveal(t,4.6,()=>lines(["用户内容是否会送往第三方服务，需要明确说明。","数据保存在哪里，与交给哪个模型处理，应当区分。"],800,714,25,"#748d61",400,1.9,"center"));
    }else{
      const q=t-12;
      reveal(q,.1,()=>text("安全模型还需要专门研究。",110,163,57,C.ink,600));
      const names=["端到端加密","服务端搜索","AI 整理","账号恢复"];
      names.forEach((label,i)=>reveal(q,.6+i*.2,()=>{const x=111+i*352;rr(x,294,322,72,12,"#e6edda","#c6d8b0");text(label,x+161,316,25,"#577943",400,"center")}));
      reveal(q,1.6,()=>text("这些能力之间的关系，需要进一步研究。",800,414,26,C.muted,400,"center"));
      reveal(q,2.6,()=>{rr(110,510,1380,141,18,C.green);lines(["现阶段不提前承诺","端到端加密或零知识存储。"],800,535,32,"#e3edd3",500,1.6,"center")});
      reveal(q,4.1,()=>lines(["HTTPS 是传输加密，","不能等同于服务器无法读取用户内容。"],800,724,27,"#6e875b",400,1.75,"center"));
    }
    phaseVeil(t,12);
  }
  function sceneSecurityResearch(t){
    background(true,t);head(12,"身份验证、安全与隐私 / 后续研究",true);
    reveal(t,.1,()=>text("更深入的安全体系，需要专门研究。",110,162,51,"#e4edda",600));
    reveal(t,.7,()=>text("具体安全模型尚未确定。",114,258,27,"#a4c18c"));
    capabilityGrid(["多因素身份验证","多设备信任机制","数据加密与密钥管理","账号与数据恢复","安全测试及漏洞审查","多用户隔离与滥用防护"],t,338,true);
    reveal(t,6.2,()=>lines(["在公开测试或官方托管前，","需要完成相应的安全验证，再扩大使用范围。"],800,728,26,"#b4cda0",400,1.8,"center"));
  }
  function archBox(x,y,w,h,title,detail,type,dark=false){
    rr(x,y,w,h,14,dark?C.green:C.white,dark?"#547943":"#d1dfc1");icon(type,x+25,y+22,34,dark?C.lime:"#739b55");text(title,x+82,y+20,25,dark?"#e3edd4":C.green,500);text(detail,x+82,y+57,17,dark?"#a2c18a":"#899f74");
  }
  function sceneArchitecture(t){
    background(false,t);head(13,"初步技术设想 / 尚未最终确定");
    if(t<12){
      reveal(t,.1,()=>text("先可靠保存，再由 AI 独立处理。",110,158,54,C.ink,600));
      reveal(t,.7,()=>archBox(450,285,700,91,"跨平台客户端","聊天界面 · 文件操作 · 本地缓存 · AI 整理视图","chat"));
      dotLine([[800,376],[800,452]],enter(t,1.2,1),"#a4bd88",2);
      text("HTTPS / HTTP API",822,407,15,"#94a77f");
      reveal(t,1.8,()=>archBox(450,452,700,91,"统一服务端","身份认证 · 消息管理 · 文件管理 · 同步 · AI 任务","server",true));
      const boxes=[{x:110,title:"消息数据库",detail:"PostgreSQL",type:"file"},{x:593,title:"文件存储",detail:"本地文件系统 / S3 兼容存储",type:"folder"},{x:1075,title:"AI 处理",detail:"分类 · 提取 · 关联 · 语义检索",type:"spark"}];
      boxes.forEach((b,i)=>{dotLine([[800,543],[800,583],[b.x+207,583],[b.x+207,625]],enter(t,2.5+i*.25,1),"#b0c599",1.5);reveal(t,3.1+i*.3,()=>archBox(b.x,625,415,105,b.title,b.detail,b.type))});
      reveal(t,4.6,()=>subtitle(["模型可以更换，索引和整理结果也可以重新生成，不把长期数据绑定到某一种模型。"]));
    }else{
      const q=t-12;
      reveal(q,.1,()=>text("初步考虑的技术方案",110,157,59,C.ink,600));
      const pairs=[["客户端 GUI","Flutter / Qt 等"],["Web 客户端","Flutter Web / React"],["服务端 / 数据库","Go / PostgreSQL"],["本地缓存","SQLite"],["文件存储","本地文件系统 / S3 兼容存储"],["同步","HTTP API + 增量同步"],["实时推送","后续按需加入 WebSocket"],["AI 模块","可配置 API / 自托管模型"],["部署","Docker Compose"],["架构","初期采用模块化单体"]];
      pairs.forEach(([label,value],i)=>{const x=i<5?110:865,y=280+(i%5)*76;reveal(q,.4+(i%5)*.18,()=>{line(x,y+65,x+625,y+65,"#d2dec5");text(label,x,y+10,20,"#8b9c7a");text(value,x+205,y+10,21,"#4c6e3b")},18)});
      reveal(q,2,()=>lines(["服务端完成持久化确认后，才标记为已保存到云端；附件也需要完整性校验。","备份、恢复与完整数据导出，是长期保存的一部分。"],800,732,23,"#6b8458",400,1.9,"center"));
    }
    phaseVeil(t,12);
  }
  const scenes=[
    {start:0,end:10,label:"开篇",description:"一个只和自己聊天的 App。这是在描述一个尚未命名的项目设想。",draw:sceneTitle},
    {start:10,end:35,label:"我和文件传输助手",description:"我经常使用微信的文件传输助手，或者直接给自己的 QQ 账号发消息。灵感、记录、文案和稿件都会顺手发进去。",draw:sceneOrigin},
    {start:35,end:55,label:"零碎的生活记录",description:"积攒喜欢的摄影、绘画与设计，记下想看的书和电影；零碎消息也留下了生活记录。到了大四，越来越依赖这种外置的记录。",draw:sceneMemory},
    {start:55,end:73,label:"想自己做一个",description:"多台电脑切换登录不方便。希望跨设备传文件，并从云端找回完整历史，再由 AI 帮忙整理。",draw:sceneNeed},
    {start:73,end:87,label:"核心理念",description:"九种用途，同一个聊天入口。不需要提前分类，直接发送。",draw:scenePurposes},
    {start:87,end:115,label:"给自己发消息",description:"原案中的八条文字与文件消息，以及建筑摄影，逐条进入同一条时间线。",draw:sceneChat},
    {start:115,end:136,label:"保存与整理",description:"云端长期存储原始消息与附件。AI 整理结果单独保存，可以修改、纠正或重新生成，不影响原始消息。",draw:sceneProcess},
    {start:136,end:161,label:"整理后的信息",description:"电影和待办从原始消息提取。形成书单影单番单、待办提醒、审美素材、学习笔记、生活回顾与智能检索。",draw:sceneOrganize},
    {start:161,end:181,label:"常用操作",description:"消息与文件传输、截图粘贴、拖放、预览、编辑、搜索，以及增量同步、离线缓存、备份恢复与完整导出。",draw:sceneFeatures},
    {start:181,end:200,label:"跨平台与自托管",description:"计划支持六平台客户端和多设备同时登录，初期计划支持在自己的公网服务器、VPS 或 NAS 自托管。",draw:sceneDevices},
    {start:200,end:222,label:"基本安全保障",description:"基础安全从第一版考虑，包括身份认证、HTTPS、访问控制、设备会话、备份恢复、基本限流防护。早期版本不等于经过全面安全审计。",draw:sceneBasicSecurity},
    {start:222,end:248,label:"AI 与隐私",description:"区分数据存储与模型处理。用户应知道哪些内容送往外部模型服务，并能控制范围。端到端加密和零知识存储尚不承诺，HTTPS不代表服务器无法读取内容。",draw:scenePrivacy},
    {start:248,end:268,label:"安全体系研究",description:"后续专门研究多因素认证、设备信任、加密密钥、账号恢复、安全测试与隔离防护。具体安全模型尚未确定，公开测试或托管前完成相应验证。",draw:sceneSecurityResearch},
    {start:268,end:292,label:"初步技术设想",description:"候选技术方案尚未确定。先可靠保存消息与附件，AI 作为独立任务。服务端持久化确认、附件完整性与备份恢复均需考虑。",draw:sceneArchitecture},
    {start:292,end:312,label:"开发规划",description:"五阶段逐步建立基础消息、自托管、AI整理、六平台客户端、可靠性安全，再考虑公开测试与托管。",draw:sceneRoadmap},
    {start:312,end:325,label:"最后想做成的样子",description:"一个真正能长期用下去的文件传输助手。目前仍处于项目构想阶段，相关功能尚待开发。",draw:sceneEnd}
  ];
  function resize(){
    const rect=screen.getBoundingClientRect();
    portrait=false;W=1600;H=900;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const pw=Math.max(1,Math.round(rect.width*dpr)),ph=Math.max(1,Math.round(rect.height*dpr));
    if(pw!==pixelWidth||ph!==pixelHeight){canvas.width=pw;canvas.height=ph;pixelWidth=pw;pixelHeight=ph}
    ctx.setTransform(pw/W,0,0,ph/H,0,0);
    return {width:W,height:H,portrait};
  }
  function render(time){
    lastTime=clamp(time,0,325);resize();
    const index=scenes.findIndex(s=>lastTime>=s.start&&lastTime<s.end),i=index<0?scenes.length-1:index,scene=scenes[i];
    ctx.save();ctx.globalAlpha=1;scene.draw(lastTime-scene.start);ctx.restore();
    // Fade through paper; text from two different scenes never shares a frame.
    const transition=.55,local=lastTime-scene.start,remaining=scene.end-lastTime;
    const veil=Math.max(i>0?1-smooth(local/transition):0,i<scenes.length-1?1-smooth(remaining/transition):0);
    if(veil>0){ctx.save();ctx.globalAlpha=veil;ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,H);ctx.restore()}
    canvas.dataset.scene=String(i);canvas.dataset.time=lastTime.toFixed(2);
    return scene;
  }
  window.InboxConceptFilm={duration:325,render,resize,scenes:scenes.map(({draw,...rest})=>rest)};
  photo.addEventListener("load",()=>render(lastTime));
  if("ResizeObserver" in window)new ResizeObserver(()=>render(lastTime)).observe(screen);
  window.addEventListener("resize",()=>render(lastTime),{passive:true});
  render(5.5);
})();
