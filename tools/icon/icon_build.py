from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
I='/workspace/qa/release75/icon/'; A='/workspace/joseph-smith-game/assets/'
m=Image.open(I+'master-1024.png').convert('RGB'); mk=Image.open(I+'maskable-1024.png').convert('RGB'); sm=Image.open(I+'simple-256.png').convert('RGB')
def rs(im,n):
    out=im.resize((n,n),Image.LANCZOS)
    if n<=64: out=out.filter(ImageFilter.UnsharpMask(radius=0.6,percent=60,threshold=0))
    return out
rs(m,180).save(A+'apple-touch-icon.png', optimize=True)
rs(m,180).save(A+'icons/apple-touch-icon-180.png', optimize=True)
rs(m,192).save(A+'icons/icon-192.png', optimize=True)
rs(m,512).save(A+'icons/icon-512.png', optimize=True)
rs(mk,512).save(A+'icons/icon-maskable-512.png', optimize=True)
rs(mk,192).save(A+'icons/icon-maskable-192.png', optimize=True)
rs(sm,32).save(A+'icons/favicon-32.png', optimize=True)
rs(sm,16).save(A+'icons/favicon-16.png', optimize=True)
rs(m,256).save('/tmp/ico256.png')
Image.open('/tmp/ico256.png').save('/workspace/joseph-smith-game/favicon.ico', sizes=[(16,16),(32,32),(48,48)])
# ---- preview sheet
W,H=1800,1180
sh=Image.new('RGB',(W,H),(24,24,28)); d=ImageDraw.Draw(sh)
def font(sz,b=True):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if b else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f,sz)
    return ImageFont.load_default()
d.text((40,28),'Palmyra Quest — app icon v75 · "Grove & pillar of light"',font=font(34),fill=(240,226,190))
d.text((40,74),'Painted procedurally (tools/icon/icon.js). No people depicted. Full bleed; maskable variant keeps the frame inside the 80% safe zone.',font=font(18,False),fill=(180,172,150))
def mask_squircle(n, e=5.0):
    big=n*4; mm=Image.new('L',(big,big),0); px=mm.load(); r=big/2
    for y in range(big):
        for x in range(big):
            if abs((x-r+0.5)/r)**e+abs((y-r+0.5)/r)**e<=1: px[x,y]=255
    return mm.resize((n,n),Image.LANCZOS)
def mask_circle(n):
    big=n*4; mm=Image.new('L',(big,big),0); ImageDraw.Draw(mm).ellipse((0,0,big-1,big-1),fill=255); return mm.resize((n,n),Image.LANCZOS)
def mask_round(n, r):
    big=n*4; mm=Image.new('L',(big,big),0); ImageDraw.Draw(mm).rounded_rectangle((0,0,big-1,big-1),radius=r*4,fill=255); return mm.resize((n,n),Image.LANCZOS)
# row 1: sizes on dark and light, iOS squircle
x=40; y=130
d.text((40,y),'iOS squircle (apple-touch-icon 180 source) at 180 · 120 · 96 · 72 · 60 · 48 px',font=font(20),fill=(220,210,180)); y+=36
for bg,yy in [((24,24,28),y),((236,232,224),y+200)]:
    d.rectangle((30,yy-10,W-30,yy+190),fill=bg); xx=50
    for n in [180,120,96,72,60,48]:
        ic=rs(m,n); sh.paste(ic,(xx,yy+(180-n)//2),mask_squircle(n)); xx+=n+40
    xx+=40
    d.text((xx,yy+20),'Android circle (maskable 512 source)',font=font(16),fill=(150,150,150) if bg[0]<100 else (60,60,60))
    xx2=xx
    for n in [144,96,48]:
        ic=rs(mk,n); sh.paste(ic,(xx2,yy+50+(144-n)//2),mask_circle(n)); xx2+=n+30
    d.text((xx2+10,yy+20),'Rounded square',font=font(16),fill=(150,150,150) if bg[0]<100 else (60,60,60))
    ic=rs(mk,144); sh.paste(ic,(xx2+10,yy+50),mask_round(144,32))
y+=430
d.text((40,y),'Favicons (simplified paint for tiny sizes), actual size and 6× nearest-neighbour zoom',font=font(20),fill=(220,210,180)); y+=40
f32=Image.open(A+'icons/favicon-32.png'); f16=Image.open(A+'icons/favicon-16.png')
sh.paste(f32,(50,y)); sh.paste(f16,(100,y+8))
sh.paste(f32.resize((192,192),Image.NEAREST),(150,y)); sh.paste(f16.resize((96,96),Image.NEAREST),(370,y))
# browser tab mock
tx=520; d.rounded_rectangle((tx,y,tx+420,y+44),radius=10,fill=(53,54,58)); sh.paste(f16,(tx+14,y+14)); d.text((tx+40,y+11),'Joseph Smith — Palmyra Quest',font=font(16,False),fill=(230,230,230))
d.rounded_rectangle((tx,y+60,tx+420,y+104),radius=10,fill=(242,242,242)); sh.paste(f16,(tx+14,y+74)); d.text((tx+40,y+71),'Joseph Smith — Palmyra Quest',font=font(16,False),fill=(30,30,30))
# home screen mock
hx=1000; hy=y-10
wall=Image.new('RGB',(760,250)); wd=ImageDraw.Draw(wall)
for i in range(250): wd.line((0,i,760,i),fill=(40+i//4,60+i//5,110+i//6))
sh.paste(wall,(hx,hy))
for k,(lab,col) in enumerate([('Photos',(250,250,250)),('Palmyra Quest',None),('Maps',(120,200,120)),('Music',(240,70,90))]):
    ix=hx+40+k*180; iy=hy+40; n=120
    if col: ic=Image.new('RGB',(n,n),col)
    else: ic=rs(m,n)
    sh.paste(ic,(ix,iy),mask_squircle(n))
    tw=d.textlength(lab,font=font(16,False)); d.text((ix+n/2-tw/2,iy+n+10),lab,font=font(16,False),fill=(255,255,255))
y+=270
d.text((40,y),'Master 1024 (regular) and maskable 1024 with the 80% safe-zone circle',font=font(20),fill=(220,210,180)); y+=36
sh.paste(rs(m,300),(50,y)); mm=rs(mk,300).copy(); ImageDraw.Draw(mm).ellipse((30,30,270,270),outline=(255,80,80),width=2); sh.paste(mm,(380,y))
sh.save('/workspace/qa/release75/icon/icon-preview-sheet.png')
print('ok')
