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
    text(String(index+1).padStart(2,"0")+" / "+String(scenes.length).padStart(2,"0"),W-m,portrait?48:42,fs,dark?"#739269":"#9baa8a",400,"right","Consolas,monospace");
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
  function storyPanel(title,t){
    shadow(()=>rr(840,205,650,515,20,C.white,"#d3dfc7"),"#23472e12",30,15);
    rr(864,229,42,42,12,C.pale);icon("chat",873,238,24);
    text(title,922,233,25,C.green,500);
    text("原案示例",1459,242,14,"#96a785",400,"right");
    line(865,292,1464,292,"#e0e7d7");
  }

  function storyBubble(value,x,y,w,kind,t,delay=0){
    reveal(t,delay,()=>{
      rr(x,y,w,87,13,C.pale);
      text(value,x+20,y+18,27,C.ink,500);
      if(kind)text(kind,x+21,y+58,16,"#839a6b");
    },24,.7);
  }

  function secureIdentity(x,y,w,h){
    rr(x,y,w,h,18,"#2e513b","#6e8d59");
    circle(x+62,y+49,17,null,"#c6dda6",2);
    ctx.beginPath();ctx.arc(x+62,y+96,27,Math.PI,0);ctx.strokeStyle="#c6dda6";ctx.lineWidth=2;ctx.stroke();
    text("账号身份",x+111,y+39,29,"#dbe9cb",500);
    text("身份验证",x+113,y+81,18,"#93b479");
  }

  function secureFocusList(items,active,y){
    items.forEach((item,i)=>{
      const fg=i===active?"#e3efd3":"#729569";
      text(String(i+1).padStart(2,"0"),114,y+i*73,19,i===active?"#afcc8a":"#55794a",400,"left","Consolas,monospace");
      text(item,159,y-3+i*73,30,fg,i===active?500:400);
      if(i===active)line(115,y+44+i*73,156,y+44+i*73,"#b1cf88",2);
    });
  }

  function sceneOrigin(t){
    background(false,t);head(1,"我和文件传输助手的故事");
    const beat=t<8.5?0:t<17.5?1:2,q=t-[0,8.5,17.5][beat];
    const scripts=[
      ["我现在经常使用微信的文件传输助手，","或者直接给自己的 QQ 账号发消息。"],
      ["突然想到的灵感、学习工作中的记录，","生活中需要记住的事情，都会发进去。"],
      ["偶尔会在里面写文案、看面试和汇报稿，","甚至顺手记下不认识的单词。"]
    ];
    reveal(t,.1,()=>lines(["文件传输助手，","早已不止是","文件传输助手。"],110,185,64,C.ink,600,1.32));
    reveal(q,.25,()=>lines(scripts[beat],114,499,26,C.muted,400,1.95));
    reveal(q,.35,()=>text(["文字与文件","备忘与记录","稿件与单词"][beat],114,685,21,"#8ba171"));
    if(beat===0){
      reveal(q,.15,()=>storyPanel("文件传输助手 / 给自己发消息",q));
      reveal(q,.8,()=>{rr(940,330,475,110,14,C.pale);icon("file",964,359,38,"#75975b");text("讲稿_v3.pdf",1024,351,30,C.ink,500);text("PDF · 1.8 MB",1026,397,18,"#8b9f77")});
      reveal(q,2.2,()=>{rr(915,483,500,110,14,C.pale);icon("folder",941,513,38,"#75975b");text("project-files.zip",1002,505,29,C.ink,500);text("128 MB",1004,550,18,"#8b9f77")});
      reveal(q,3.4,()=>text("在不同设备之间传递文字和文件",1165,652,22,"#849c6e",400,"center"));
    }else if(beat===1){
      reveal(q,.15,()=>storyPanel("随手留下的记录",q));
      storyBubble("明早给老师发邮件",1020,342,395,"待办与日程",q,.65);
      storyBubble("今天终于把实验跑通了",942,485,473,"学习工作中的记录",q,2);
      reveal(q,3.2,()=>text("灵感 · 学习工作 · 生活中要记住的事",1165,652,20,"#849c6e",400,"center"));
    }else{
      reveal(q,.15,()=>storyPanel("写稿，也顺手记个单词",q));
      reveal(q,.65,()=>{rr(883,325,355,274,12,"#f0f3e9","#dbe5cf");text("Presentation 稿件",905,348,24,C.green,500);lines(["各位老师好，我今天汇报的","题目是……首先介绍一下","课题的研究背景……"],905,405,20,"#809469",400,1.9);line(905,547,1198,547,"#cddcbd");text("讲稿_v3.pdf",905,565,17,"#8da17a")});
      reveal(q,1.9,()=>{rr(1260,325,191,274,12,C.pale);text("顺手记下",1281,351,18,"#90a578");text("serendipity",1280,409,25,C.green,400,"left","Georgia,serif");lines(["偶然发现","美好事物","的机缘"],1282,462,21,"#7b9664",400,1.6)});
      reveal(q,3.3,()=>text("同一个聊天入口，留下不同的内容",1165,652,21,"#849c6e",400,"center"));
    }
    reveal(q,1.5,()=>subtitle([["除了传文件，也逐渐当成了备忘录。","有时候直接当成备忘录、日程提醒或者 To-do List 来用。","这些随手记下的内容，之后还会再打开看。"][beat]]));
    phaseVeil(t,8.5);phaseVeil(t,17.5);
  }

  function deviceScreenContent(x, y, w, h, accent = false) {
    const inset = Math.max(3, Math.min(w, h) * .055);
    const sidebar = w * .22;
    const tint = accent ? "#c8d9b6" : "#d8e4cc";
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    rr(x, y, w, h, Math.max(2, inset * .7), "#edf2e7");
    rr(x, y, sidebar, h, 0, "#e0e9d5");
    for (let i = 0; i < 3; i++) {
      rr(x + inset, y + inset * (1.4 + i * 2.3), sidebar - inset * 2,
        Math.max(2, inset * .55), 1.5, "#b8cba5");
    }
    const conversationX = x + sidebar + inset;
    const conversationW = w - sidebar - inset * 2;
    const bubbleH = Math.max(4, h * .12);
    const gap = h * .09;
    [ .84, .66, .77 ].forEach((fraction, i) => {
      const bw = conversationW * fraction;
      rr(x + w - inset - bw, y + inset * 1.4 + i * (bubbleH + gap),
        bw, bubbleH, Math.max(2, bubbleH * .28), tint);
    });
    rr(conversationX, y + h - inset * 1.5 - bubbleH * .65,
      conversationW, bubbleH * .65, Math.max(2, bubbleH * .2), "#dfe8d5");
    ctx.restore();
  }

  function deviceCloudNode(x, y, w, h, title, detail) {
    shadow(() => rr(x, y, w, h, 19, "#f8fbf1", "#c7d8b7"),
      "#2a4f2510", 25, 10);
    rr(x + 22, y + 25, 61, 61, 17, "#e0ebd2");
    icon("cloud", x + 34, y + 37, 37, "#608b46");
    text(title, x + 108, y + 24, 30, C.ink, 500);
    text(detail, x + 109, y + 70, 19, "#7a9067");
  }

  function deviceIndependentLink(points, t, delay, speed = .25) {
    // Each path has one cloud port and one client. There is no client-to-client
    // segment and no shared horizontal bus that can look like device chaining.
    const p = enter(t, delay, 1.15);
    dotLine(points, p, "#9eb98a", 1.7);
    if (t > delay + 1.3) {
      packet(points.slice().reverse(), (t - delay) * speed, "#739c55");
    }
  }

  function drawDevice(x, y, w, h, name, type = "desktop", accent = false) {
    // w × h is an allocation, including an optional platform label. Screens keep
    // their proportions; shrinking the allocation never stretches a device.
    const labelSpace = name ? 36 : 0;
    const availableH = Math.max(24, h - labelSpace);
    const frame = accent ? "#9db88b" : "#b8cba8";
    const body = accent ? "#e3ecd6" : "#f8faf2";
    const cx = x + w / 2;
    let actualW, actualH;

    if (type === "phone") {
      // The complete phone body is 9:18, not a tall screen inside a wide frame.
      actualW = Math.min(w * .46, availableH / 2);
      actualH = actualW * 2;
      const left = cx - actualW / 2;
      const radius = actualW * .15;
      rr(left, y, actualW, actualH, radius, body, frame, 1.8);
      const bezel = Math.max(4, actualW * .065);
      const top = Math.max(11, actualH * .105);
      deviceScreenContent(left + bezel, y + top, actualW - bezel * 2,
        actualH - top - bezel * 1.8, accent);
      rr(cx - actualW * .16, y + actualH * .043, actualW * .32,
        Math.max(2.5, actualW * .035), 2, "#a5ba92");
    } else if (type === "web" || type === "browser") {
      // A browser window has its own chrome and a 16:10 outer ratio.
      actualW = Math.min(w, availableH * 1.6);
      actualH = actualW / 1.6;
      const left = cx - actualW / 2;
      const bar = Math.max(15, actualH * .18);
      rr(left, y, actualW, actualH, 9, body, frame, 1.8);
      rr(left + 1, y + 1, actualW - 2, bar, [8, 8, 0, 0], "#dfe8d4");
      for (let i = 0; i < 3; i++) {
        circle(left + 9 + i * 7, y + bar / 2, 1.8, "#a4b98f");
      }
      rr(left + actualW * .27, y + bar * .28, actualW * .59,
        bar * .4, 3, "#f2f6e9");
      const inset = Math.max(5, actualW * .028);
      deviceScreenContent(left + inset, y + bar + inset,
        actualW - inset * 2, actualH - bar - inset * 2, accent);
    } else if (type === "laptop") {
      // The display is 16:10; the keyboard base adds only a shallow strip.
      actualW = Math.min(w / 1.06, availableH / .7);
      const screenH = actualW / 1.6;
      const baseH = actualW * .055;
      actualH = screenH + baseH;
      const left = cx - actualW / 2;
      rr(left, y, actualW, screenH, actualW * .035, body, frame, 1.8);
      const bezel = Math.max(6, actualW * .035);
      deviceScreenContent(left + bezel, y + bezel,
        actualW - bezel * 2, screenH - bezel * 2, accent);
      ctx.beginPath();
      ctx.moveTo(left - actualW * .03, y + screenH - 1);
      ctx.lineTo(left + actualW * 1.03, y + screenH - 1);
      ctx.lineTo(left + actualW * .985, y + screenH + baseH);
      ctx.lineTo(left + actualW * .015, y + screenH + baseH);
      ctx.closePath();
      ctx.fillStyle = "#c4d4b5";
      ctx.fill();
      rr(cx - actualW * .105, y + screenH + 1,
        actualW * .21, Math.max(2, baseH * .28), 2, "#9eb68a");
    } else {
      // A desktop display is 16:10, with a short stand outside the screen.
      actualW = Math.min(w, availableH / .738);
      const screenH = actualW / 1.6;
      const neckH = actualW * .095;
      const baseH = actualW * .018;
      actualH = screenH + neckH + baseH;
      const left = cx - actualW / 2;
      rr(left, y, actualW, screenH, actualW * .035, body, frame, 1.8);
      const bezel = Math.max(6, actualW * .035);
      deviceScreenContent(left + bezel, y + bezel,
        actualW - bezel * 2, screenH - bezel * 2, accent);
      rr(cx - actualW * .035, y + screenH, actualW * .07,
        neckH, 1, "#b0c59a");
      rr(cx - actualW * .22, y + screenH + neckH,
        actualW * .44, Math.max(3, baseH), 2, "#9fb78b");
    }

    if (name) {
      text(name, cx, y + availableH + 11, 22, "#657f53", 400, "center");
    }
    return { cx, top: y, width: actualW, height: actualH };
  }

  function sceneNeed(t) {
    background(false, t);
    head(3, "原案中的需求");
    reveal(t, .1, () => lines([
      "我希望所有消息和文件，",
      "都能长期保存在云端。"
    ], 110, 165, 54, C.ink, 600, 1.36));

    const clients = [
      { cx: 350, name: "macOS", type: "laptop" },
      { cx: 800, name: "Windows", type: "desktop" },
      { cx: 1250, name: "Linux", type: "desktop" }
    ];
    const paths = [
      [[690, 460], [690, 505], [350, 505], [350, 580]],
      [[800, 460], [800, 580]],
      [[910, 460], [910, 505], [1250, 505], [1250, 580]]
    ];

    paths.forEach((points, i) => deviceIndependentLink(points, t, 3.2 + i * .3));
    reveal(t, 1.05, () => {
      deviceCloudNode(570, 340, 460, 120,
        "云端长期存储", "消息与附件 · 完整历史记录");
      text("设想", 1006, 357, 13, "#93a47f", 400, "right");
    });
    clients.forEach((client, i) => reveal(t, 1.8 + i * .4, () => {
      drawDevice(client.cx - 145, 580, 290, 200,
        client.name, client.type, false);
    }, 24));

    reveal(t, 5.25, () => subtitle([
      t < 11
        ? "换了设备，也能找回完整的历史记录。"
        : "历史记录不需要依赖旧设备在线。"
    ]));
  }

  function fusionBezier(a,b,c,d,p){
    const q=1-p;
    return {x:q*q*q*a.x+3*q*q*p*b.x+3*q*p*p*c.x+p*p*p*d.x,y:q*q*q*a.y+3*q*q*p*b.y+3*q*p*p*c.y+p*p*p*d.y};
  }
  function fusionPath(points,p,color,alpha=1){
    ctx.save();ctx.globalAlpha*=alpha;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    const count=40,stop=Math.max(1,Math.ceil(clamp(p)*count));
    for(let j=1;j<=stop;j++){const s=clamp(p)*j/stop,v=fusionBezier(...points,s);ctx.lineTo(v.x,v.y)}
    ctx.strokeStyle=color;ctx.lineWidth=1.25;ctx.stroke();ctx.restore();
  }
  function fusionThread(x,y,w,h,t,events,zoom){
    const enterWindow=enter(t,.9,1.1);
    group(enterWindow,0,(1-enterWindow)*22,()=>{
      shadow(()=>rr(x,y,w,h,lerp(17,20,zoom),C.white,"#cbdabb"),"#2545231c",35,17);
      const pad=lerp(16,22,zoom),header=lerp(67,77,zoom),avatar=lerp(29,40,zoom),fs=lerp(15,21,zoom);
      rr(x+pad,y+18,avatar,avatar,lerp(9,12,zoom),C.pale);
      icon("chat",x+pad+avatar*.2,y+18+avatar*.2,avatar*.6);
      text("给自己发消息",x+pad+avatar+12,y+17,fs,C.ink,600);
      text("我的聊天记录",x+pad+avatar+12,y+19+fs+7,lerp(10,13,zoom),"#92a27e");
      line(x+pad,y+header,x+w-pad,y+header,"#e0e7d5");
      const bodyTop=y+header+13,bodyBottom=y+h-59,row=Math.min(51,(bodyBottom-bodyTop)/9),bubbleH=Math.min(37,row-6);
      ctx.save();ctx.beginPath();ctx.rect(x+pad,bodyTop,w-pad*2,bodyBottom-bodyTop+1);ctx.clip();
      const received=events.filter(e=>t>=e.arrive);
      const occupied=received.length;
      received.forEach((e,k)=>{
        const settle=enter(t,e.arrive,.42),last=received[received.length-1],push=last&&k<occupied-1?enter(t,last.arrive,.42):1;
        const remaining=occupied-1-k;
        const yy=bodyBottom-bubbleH-remaining*row+(k<occupied-1?(1-push)*row:0);
        const bw=lerp(w*.62,w*.74,zoom),bx=x+w-pad-bw;
        group(settle,(1-settle)*18,(1-settle)*12,()=>{
          rr(bx,yy,bw,bubbleH,lerp(7,10,zoom),"#e6eedc");
          const is=Math.min(22,bubbleH-13);
          icon(purposes[e.index][0],bx+10,yy+(bubbleH-is)/2,is,"#7c9b61");
          rr(bx+is+22,yy+bubbleH*.34,bw*.47,3.5,2,"#b4c79f");
          rr(bx+is+22,yy+bubbleH*.62,bw*.29,3.5,2,"#c8d6b8");
        });
      });
      ctx.restore();
      rr(x+pad,y+h-38,w-pad*2,24,6,"#edf2e6");
      text("给自己发消息…",x+pad+10,y+h-33,lerp(9,10,zoom),"#98a98a");
      // The short illuminated line is the only shared entrance.
      const hit=events.reduce((v,e)=>Math.max(v,1-clamp(Math.abs(t-e.arrive)/.36)),0);
      group(hit*.9,0,0,()=>{
        line(x-1,y+h-39,x-1,y+h-13,"#8ab065",3);
        circle(x-1,y+h-26,8,null,"#a8c88b",1);
      });
    });
  }
  function scenePurposes(t){
    background(false,t);head(4,"核心理念");
    const order=[2,5,8,1,4,7,0,3,6];
    const events=order.map((index,n)=>({index,start:4.75+n*.4,arrive:4.75+n*.4+2.05}));
    const zoom=smooth((t-11.15)/2.6),sourceFade=1-smooth((t-10.25)/.7);
    const initialTitle=enter(t,.1,.85)*(1-smooth((t-10.1)/.4));
    group(initialTitle,0,(1-enter(t,.1,.85))*25,()=>text("多种用途，一个聊天入口。",800,157,60,C.ink,600,"center"));
    const x=lerp(1168,830,zoom),y=lerp(290,112,zoom),w=lerp(310,580,zoom),h=lerp(460,720,zoom);
    const source={x:136,y:286,w:280,h:108,gap:22};
    const port={x:1168,y:724};
    const positions=purposes.map((_,i)=>({x:source.x+(i%3)*(source.w+source.gap),y:source.y+Math.floor(i/3)*(source.h+source.gap)}));

    // Subtle curves appear after the complete grid has been read.
    if(t>4.1&&sourceFade>0){
      events.forEach(e=>{
        const s=positions[e.index],a={x:s.x+source.w/2,y:s.y+source.h/2};
        const points=[a,{x:a.x+205,y:a.y},{x:1090,y:a.y},{x:port.x,y:port.y}];
        fusionPath(points,1,"#b7cba4",sourceFade*.22*enter(t,4.1,.6));
      });
    }
    purposes.forEach(([name,label],i)=>{
      const e=events.find(v=>v.index===i),p=positions[i],ready=enter(t,.4+i*.1,.7);
      const peel=smooth((t-e.start)/.42),gone=smooth((t-e.start)/.2),a=ready*sourceFade;
      group(a,0,(1-ready)*20,()=>{
        // The unlabelled outline remains briefly, making each departure legible.
        rr(p.x,p.y,source.w,source.h,15,lerp(1,0,gone)>.01?"#f8fbf2":"#f0f4e8","#d5e1c8");
        group(1-gone,0,0,()=>{
          icon(name,p.x+source.w/2-16,p.y+21,32,"#729454");
          text(label,p.x+source.w/2,p.y+71,23,"#4b653d",400,"center");
        });
        group((1-Math.abs(peel*2-1))*.7,0,0,()=>rr(p.x,p.y,source.w,source.h,15,null,"#9bbf78",2));
      });
    });
    // Right column leaves first, so later rows cross vacated cells rather than
    // covering labels that are still being read. At most two pieces share a lane.
    events.forEach(e=>{
      const flight=clamp((t-e.start-.2)/1.85);
      if(t<e.start+.2||t>e.arrive+.12)return;
      const s=positions[e.index],a={x:s.x+source.w/2,y:s.y+source.h/2};
      const points=[a,{x:a.x+205,y:a.y},{x:1090,y:a.y},{x:port.x,y:port.y}];
      const p=fusionBezier(...points,smooth(flight));
      const into=1-smooth((flight-.83)/.17),appearance=enter(t,e.start+.2,.22),width=lerp(202,105,smooth((flight-.65)/.35)),height=lerp(51,28,flight);
      group(appearance*into,0,0,()=>{
        fusionPath(points,smooth(flight),"#a2bd89",.45);
        shadow(()=>rr(p.x-width/2,p.y-height/2,width,height,9,C.white,"#b8cea1"),"#62804312",12,6);
        icon(purposes[e.index][0],p.x-width/2+13,p.y-11,22,"#719650");
        rr(p.x-width/2+47,p.y-4,width*.45,3.5,2,"#b0c49b");
        rr(p.x-width/2+47,p.y+5,width*.28,3.5,2,"#cedbbf");
      },1,p.x,p.y,(flight<.8?Math.sin(flight*Math.PI)*.035:0)*(s.y<500?1:-1));
    });
    fusionThread(x,y,w,h,t,events,zoom);
    group(enter(t,1.5,.8)*(1-smooth((t-10.3)/.6)),0,0,()=>text("同一条时间线",1323,778,17,"#8aa273",400,"center"));
    group(enter(t,2.1,.7)*(1-smooth((t-10.3)/.6)),0,0,()=>subtitle(["不需要提前分类，直接发送。"]));
    const finalTitle=enter(t,11.1,.95);
    group(finalTitle,0,(1-finalTitle)*25,()=>{
      lines(["多种用途，","一个聊天入口。"],110,258,58,C.ink,600,1.4);
      lines(["所有信息先作为普通消息，","进入同一条时间线。"],114,475,25,C.muted,400,1.95);
      line(115,625,173,625,"#91ac74",2);
      text("不需要提前判断它属于哪个分类。",115,661,19,"#8a9c77");
    });
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
  function sceneDevices(t) {
    background(false, t);
    head(9, "计划中的使用形态");
    reveal(t, .1, () => lines([
      "六平台客户端",
      "与多设备同时登录。"
    ], 110, 165, 54, C.ink, 600, 1.36));

    const clients = [
      { cx: 175, name: "Windows", type: "desktop" },
      { cx: 425, name: "macOS", type: "laptop" },
      { cx: 675, name: "Linux", type: "desktop" },
      { cx: 925, name: "Android", type: "phone" },
      { cx: 1175, name: "iOS", type: "phone" },
      { cx: 1425, name: "Web", type: "browser" }
    ];
    const ports = [650, 710, 770, 830, 890, 950];

    // Ordered fan-out ports preserve the same left-to-right order as the six
    // clients, so none of these independent cloud paths crosses another one.
    clients.forEach((client, i) => {
      deviceIndependentLink([
        [ports[i], 450],
        [client.cx, 552],
        [client.cx, 580]
      ], t, 4.25 + i * .15, .22);
    });

    reveal(t, 1.05, () => {
      deviceCloudNode(580, 340, 440, 110,
        "统一服务端", "同一账号体系");
      text("计划支持", 996, 357, 13, "#93a47f", 400, "right");
    });
    clients.forEach((client, i) => reveal(t, 1.8 + i * .38, () => {
      drawDevice(client.cx - 95, 580, 190, 180,
        client.name, client.type, false);
    }, 23));

    reveal(t, 8.0, () => {
      rr(1130, 320, 360, 128, 17, C.green);
      icon("server", 1155, 342, 33, "#c8dfa1");
      text("初期自托管", 1210, 341, 25, "#e5efd7", 500);
      text("计划", 1466, 338, 12, "#a9c48d", 400, "right");
      text("公网服务器 · VPS · NAS", 1157, 397, 19, "#c1d5ab");
    }, 22);

    reveal(t, 5.9, () => subtitle([
      t < 9.3
        ? "同一账号体系，多台设备可以同时在线。"
        : "初期支持自行管理消息、附件及备份。"
    ]));
  }

  const milestones=["基础消息系统与自托管","AI 整理与归纳","六平台客户端与个人信息管理","长期可靠性与安全体系研究","公开测试与官方托管"];
  function sceneRoadmap(t){
    background(true,t);head(13,"开发阶段规划",true);
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
    background(false,t);head(14,"最后想做成的样子");
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
    const beat=t<7?0:t<14?1:2,q=t-beat*7;
    const titles=[["积攒喜欢的","作品和创意。"],["想看的书、电影，","和想补的番。"],["零零碎碎的消息，","也留下生活的记录。"]];
    const scripts=[
      ["看到好看的摄影、绘画、设计作品，","也会顺手发进去，积攒审美，方便以后学习模仿。"],
      ["想看的书、电影和想补的番也会记下来，","免得之后忘了。"],
      ["不用专门写日记，也能回顾过去的日子。","到了大四，要记住的事情越来越多，","也就更加依赖这种外置的记录。"]
    ];
    reveal(q,.1,()=>lines(titles[beat],110,205,59,C.ink,600,1.4));
    reveal(q,.5,()=>lines(scripts[beat],114,459,25,C.muted,400,1.95));
    if(beat===0){
      reveal(q,.25,()=>{shadow(()=>rr(945,210,480,502,18,C.white,"#d4dfc7"));photoCrop(965,230,440,401,10);text("黑白建筑摄影",975,655,23,C.green,500);text("原案中的审美素材示例",975,691,15,"#90a27d")});
    }else if(beat===1){
      reveal(q,.2,()=>storyPanel("书影音清单",q));
      storyBubble("想看《布达佩斯大饭店》",918,350,497,"电影 · 想看",q,.7);
      storyBubble("想补《冰菓》",1060,493,355,"想补的番",q,2.2);
    }else{
      reveal(q,.2,()=>storyPanel("翻一翻自己的消息",q));
      reveal(q,.6,()=>{line(908,337,908,641,"#c5d7b1",2)});
      reveal(q,.9,()=>{circle(908,369,5,"#87a36b");text("今天终于把实验跑通了",941,348,28,C.green,500);text("学习与工作",942,389,17,"#91a67d")});
      reveal(q,2.1,()=>{circle(908,481,5,"#87a36b");text("明早给老师发邮件",941,460,28,C.green,500);text("需要记住的事情",942,501,17,"#91a67d")});
      reveal(q,3.4,()=>{circle(908,594,5,"#87a36b");text("想看《布达佩斯大饭店》",941,573,26,C.green,500);text("随手留下的生活记录",942,615,17,"#91a67d")});
    }
    reveal(q,1.6,()=>subtitle([[ "喜欢的作品先留下来，方便以后再看。","想看的东西，免得之后忘了。","想到什么直接发条消息，总比打开笔记软件、新建文档、考虑怎么分类方便得多。" ][beat]]));
    phaseVeil(t,7);phaseVeil(t,14);
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
    background(true,t);head(10,"身份验证与网络安全 / 初期基本保障",true);
    if(t<15){
      reveal(t,.1,()=>lines(["身份验证","与设备会话管理"],110,182,61,"#e5efd8",600,1.36));
      secureFocusList(["安全身份认证","设备与会话管理"],t<7?0:1,413);
      reveal(t,1.2,()=>lines(["后续研究","多因素身份验证 · 多设备信任机制"],114,661,20,"#91b379",400,1.9));
      reveal(t,.5,()=>secureIdentity(1000,259,370,145));
      if(t>=7){
        const q=t-7;
        const nodes=[{x:815,label:"设备 01"},{x:1073,label:"设备 02"},{x:1331,label:"设备 03"}];
        nodes.forEach((node,i)=>{
          const pth=[[1185,404],[1185,470],[node.x+83,470],[node.x+83,528]];
          dotLine(pth,enter(q,.3+i*.2,1),"#739e5b",1.7);
          reveal(q,.9+i*.25,()=>{rr(node.x,528,166,131,14,"#294b33","#668a52");rr(node.x+22,548,122,65,7,null,"#9cbc7d",1.5);text(node.label,node.x+83,630,17,"#b8d29c",400,"center")});
        });
        reveal(q,.4,()=>text("会话",1212,433,19,"#91b379"));
      }else{
        reveal(t,1.7,()=>{rr(1030,469,310,134,15,"#264931","#527b45");icon("shield",1060,510,39,"#91b873");text("安全身份认证",1121,518,25,"#c6dda9",500)});
      }
      subtitle(["长期保存个人信息，账号安全从最初的设计开始考虑。"],true);
    }else{
      const q=t-15,active=q<5?0:q<10?1:2;
      reveal(q,.1,()=>lines(["传输加密","与访问防护"],110,182,64,"#e5efd8",600,1.36));
      secureFocusList(["HTTPS 传输加密","数据访问控制","基本限流与防护"],active,410);
      reveal(q,.7,()=>text("后续研究：安全测试及漏洞审查",114,686,20,"#91b379"));
      reveal(q,.3,()=>{rr(810,389,180,145,15,"#2b4f37","#64854f");icon("chat",878,414,43,"#bad49b");text("客户端",900,481,25,"#d7e8c4",500,"center")});
      reveal(q,.3,()=>{rr(1170,280,325,365,20,"#294a33","#64854f");icon("server",1196,307,35,"#adce8d");text("服务端",1249,312,28,"#d7e8c4",500)});
      const path=[[990,461],[1170,461]];dotLine(path,enter(q,.6,1),active===0?"#c7df9d":"#688f52",active===0?3:1.5);
      if(q>1.4)packet(path,q*.24,"#b6d48b");
      reveal(q,.7,()=>{text("HTTPS",1080,403,23,active===0?"#d5e7b6":"#87ac6d",500,"center");text("传输加密",1080,494,17,"#8eb475",400,"center")});
      const modules=[{y:382,label:"访问控制",focus:active===1},{y:508,label:"限流与防护",focus:active===2}];
      modules.forEach(m=>{rr(1195,m.y,275,88,12,m.focus?"#50713e":"#35563a",m.focus?"#b4d18b":"#5c7d48",m.focus?2:1);text(m.label,1332,m.y+27,25,m.focus?"#ebf3d8":"#9fbe87",m.focus?500:400,"center")});
      subtitle(["基础安全从第一阶段建设，具体方案需要专门研究与验证。"],true);
    }
    phaseVeil(t,15,true);
  }



  function scenePrivacy(t){
    background(false,t);head(11,"AI 与隐私 / 补充说明");
    reveal(t,.1,()=>text("知道哪些数据被处理，并能控制范围。",110,166,51,C.ink,600));
    const parts=[{x:110,title:"原始记录",small:"消息 · 文档 · 图片",name:"folder"},{x:593,title:"处理范围",small:"由用户控制",name:"list"},{x:1075,title:"模型服务",small:"可配置 API / 自托管模型",name:"spark"}];
    parts.forEach((p,i)=>reveal(t,.6+i*.4,()=>{rr(p.x,363,415,240,18,i===1?C.green:C.white,i===1?"#537c41":"#d1dec2");icon(p.name,p.x+28,394,38,i===1?C.lime:"#7d9b62");text(p.title,p.x+28,467,31,i===1?"#e4efd5":C.green,500);text(p.small,p.x+28,534,21,i===1?"#accb8f":"#8a9e77")}));
    dotLine([[525,480],[581,480]],enter(t,1.2,.8),"#9ab47c",2);dotLine([[1008,480],[1063,480]],enter(t,1.8,.8),"#9ab47c",2);
    reveal(t,1.7,()=>lines(["用户应当知道哪些数据会送往外部模型服务。","并能控制 AI 的处理范围。"],800,715,25,C.muted,400,1.9,"center"));
  }



  function archBox(x,y,w,h,title,detail,type,dark=false){
    rr(x,y,w,h,14,dark?C.green:C.white,dark?"#547943":"#d1dfc1");icon(type,x+25,y+22,34,dark?C.lime:"#739b55");text(title,x+82,y+20,25,dark?"#e3edd4":C.green,500);text(detail,x+82,y+57,17,dark?"#a2c18a":"#899f74");
  }
  function sceneArchitecture(t){
    background(false,t);head(12,"初步技术设想 / 尚未最终确定");
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
    {start:0,end:9,label:"开篇",description:"这是对一个项目设想的描述，不是项目名称。",draw:sceneTitle},
    {start:9,end:36,label:"我和文件传输助手",description:"从传文件，到备忘、记录、稿件和单词，每段文案对应当时的画面。",draw:sceneOrigin},
    {start:36,end:57,label:"零碎的生活记录",description:"摄影只配摄影；电影和番剧只配相应消息；生活记录对应消息时间线。",draw:sceneMemory},
    {start:57,end:75,label:"想自己做一个",description:"macOS、Windows 和 Linux 分别连接云端，找回完整历史记录。",draw:sceneNeed},
    {start:75,end:93,label:"核心理念",description:"九种用途沿各自路径成为消息，共同进入唯一聊天入口，保留在同一条时间线。",draw:scenePurposes},
    {start:93,end:121,label:"给自己发消息",description:"原案中的八条文字和文件消息，以及建筑摄影。",draw:sceneChat},
    {start:121,end:140,label:"保存与整理",description:"云端保存原始记录，AI 整理结果可以修改，不影响原始消息。",draw:sceneProcess},
    {start:140,end:163,label:"整理后的信息",description:"电影与待办提取，再形成六种信息视图。",draw:sceneOrganize},
    {start:163,end:183,label:"常用操作",description:"消息与文件传输、编辑、预览、搜索，以及离线缓存、备份恢复和完整导出。",draw:sceneFeatures},
    {start:183,end:201,label:"六平台与自托管",description:"六个平台各自使用客户端或浏览器，连接同一服务端；初期计划支持自托管。",draw:sceneDevices},
    {start:201,end:231,label:"身份验证与网络安全",description:"安全身份认证、设备与会话管理、HTTPS 传输加密、数据访问控制、基本限流与防护。",draw:sceneBasicSecurity},
    {start:231,end:239,label:"AI 与隐私",description:"用户应知道哪些数据会送往外部模型服务，并控制 AI 处理范围。",draw:scenePrivacy},
    {start:239,end:263,label:"初步技术设想",description:"候选技术方案尚未确定，先可靠保存，再由独立任务进行 AI 处理。",draw:sceneArchitecture},
    {start:263,end:283,label:"开发规划",description:"五个开发阶段，基础安全从第一阶段开始。",draw:sceneRoadmap},
    {start:283,end:296,label:"最后想做成的样子",description:"一个真正能长期用下去的文件传输助手。相关功能尚待开发。",draw:sceneEnd}
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
    lastTime=clamp(time,0,296);resize();
    const index=scenes.findIndex(s=>lastTime>=s.start&&lastTime<s.end),i=index<0?scenes.length-1:index,scene=scenes[i];
    ctx.save();ctx.globalAlpha=1;scene.draw(lastTime-scene.start);ctx.restore();
    // Fade through paper; text from two different scenes never shares a frame.
    const transition=.55,local=lastTime-scene.start,remaining=scene.end-lastTime;
    const veil=Math.max(i>0?1-smooth(local/transition):0,i<scenes.length-1?1-smooth(remaining/transition):0);
    if(veil>0){ctx.save();ctx.globalAlpha=veil;ctx.fillStyle=C.paper;ctx.fillRect(0,0,W,H);ctx.restore()}
    canvas.dataset.scene=String(i);canvas.dataset.time=lastTime.toFixed(2);
    return scene;
  }
  window.InboxConceptFilm={duration:296,render,resize,scenes:scenes.map(({draw,...rest})=>rest)};
  photo.addEventListener("load",()=>render(lastTime));
  if("ResizeObserver" in window)new ResizeObserver(()=>render(lastTime)).observe(screen);
  window.addEventListener("resize",()=>render(lastTime),{passive:true});
  render(5.5);
})();
