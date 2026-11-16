"""The approved action-sound design, independent of the licensed music."""
import numpy as np
from scipy import signal
SR=44100
N=114*SR

def norm(x):
    return (x/(np.max(np.abs(x))+1e-9)).astype(np.float32)

def filt(x,low=None,high=None,order=2):
    if low and high:sos=signal.butter(order,[low,high],btype='bandpass',fs=SR,output='sos')
    elif low:sos=signal.butter(order,low,btype='highpass',fs=SR,output='sos')
    else:sos=signal.butter(order,high,btype='lowpass',fs=SR,output='sos')
    return signal.sosfilt(sos,x).astype(np.float32)

def edges(x,attack=.006,release=.045):
    x=x.copy();a=min(len(x),round(attack*SR));r=min(len(x),round(release*SR))
    if a:
        env=np.sin(np.linspace(0,np.pi/2,a))**2
        x[:a]*=env[:,None] if x.ndim==2 else env
    if r:
        env=np.cos(np.linspace(0,np.pi/2,r))**2
        x[-r:]*=env[:,None] if x.ndim==2 else env
    return x

def add(bus,x,start,gain=1,pan=0,pan_end=None):
    pos=round(start*SR)
    if pos>=N:return
    if pos<0:x=x[-pos:];pos=0
    x=x[:N-pos];length=len(x)
    if x.ndim==2:
        bus[pos:pos+length]+=x*gain
        return
    if pan_end is None:angle=(np.clip(pan,-1,1)+1)*np.pi/4
    else:angle=(np.linspace(pan,pan_end,length).clip(-1,1)+1)*np.pi/4
    bus[pos:pos+length,0]+=x*np.cos(angle)*gain
    bus[pos:pos+length,1]+=x*np.sin(angle)*gain

def room(bus,decay=.62,level=1):
    # Independent diffuse tails plus short, asymmetric early reflections.
    length=round(1.25*SR)
    out=np.zeros_like(bus)
    for c in range(2):
        rng=np.random.default_rng(831+c)
        t=np.arange(length)/SR
        ir=filt(rng.normal(size=length),180,4200)*np.exp(-t/decay)*.0006
        ir[:round(.012*SR)]=0
        for sec,g in [(.018,.16),(.031,.12),(.047,.087),(.073,.062),(.101,.045)]:
            ir[round((sec+c*.0027)*SR)]+=g
        out[:,c]=signal.fftconvolve(bus[:,c],ir,mode='full')[:N]*level
    return out

def foley_event(event,index):
    kind=event['type'];duration=event.get('duration',.15)
    rng=np.random.default_rng(12000+index*127)
    t=np.arange(max(1,round(duration*SR)))/SR
    white=rng.normal(size=len(t))
    soft=filt(white,220,2200)
    grain=filt(white,650,5200)
    variation=event.get('variation',0)
    if kind in ('felt_arrival','felt_key','felt_low','soft_settle','closing_settle'):
        freq=180+variation*9 if kind=='felt_low' else 270+variation*11
        wood=np.sin(2*np.pi*freq*t)*np.exp(-t/.018)
        wood+=.38*np.sin(2*np.pi*freq*1.73*t)*np.exp(-t/.009)
        x=wood*.55+soft*.38*np.exp(-t/.012)+grain*.08*np.exp(-t/.008)
        x*=1-np.exp(-t/.0015)
    elif kind=='tension_drag':
        # A strap's discrete stick/slip contacts accelerate as it is pulled.
        # The low elastic creak and the small contacts form one short gesture.
        x=np.zeros(len(t))
        contacts=np.array([.006,.025,.043,.060,.076,.090,.103,.115,.126])
        contacts*=duration/.14
        for n,start in enumerate(contacts):
            u=np.maximum(t-start,0);active=t>=start
            modal=np.sin(2*np.pi*(290+n*8)*u)+.31*np.sin(2*np.pi*(710-n*9)*u)
            x+=modal*np.exp(-u/.0037)*active*(.37+.11*np.sin(n*.7))
        phase=2*np.pi*(105*t+32*t*t/max(duration,1e-3))
        elastic=np.sin(phase)+.18*np.sin(phase*2.13)
        pressure=np.sin(np.pi*t/duration)**.8
        x=(x+.13*elastic)*pressure
        x+=.045*soft*pressure*(.4+.6*np.sin(2*np.pi*39*t)**2)
        x=filt(x,90,2100)
    elif kind=='felt_marker':
        # Dense fibre chatter follows nib pressure, without a separate tap.
        pressure=np.sin(np.pi*t/duration)**.65
        speed=95+65*(t/duration)
        phase=2*np.pi*np.cumsum(speed)/SR
        fibres=(.48+.32*np.sin(phase)+.2*np.sin(phase*2.73+.5))
        ink=filt(white,650,2700)
        tiny=filt(white,1700,3500)
        x=(ink*fibres+.12*tiny*np.sin(phase*.53)**4)*pressure
        x=filt(x,250,2850)
    elif kind=='card_fan':
        # Six overlapping card-edge flutters make a single fanning gesture.
        # Each leaf follows its own left/middle/right receiving card position.
        x=np.zeros((len(t),2))
        lead=filt(white,200,1100)*np.sin(np.pi*np.minimum(t/.175,1))**1.7*(t<.175)*.045
        x[:,0]+=lead*.707;x[:,1]+=lead*.707
        peaks=event.get('leaf_peaks',[.32,.39,.46,.53,.60,.67])
        pans=event.get('leaf_pans',[-.35,0,.35,-.35,0,.35])
        for n,(peak,pan,level) in enumerate(zip(peaks,pans,[.54,.72,.84,.82,.69,.50])):
            length=.17;start=peak-length/2
            u=np.maximum(t-start,0);inside=(t>=start)&(t<start+length)
            env=np.sin(np.pi*np.minimum(u/length,1))**1.6*inside
            edge=filt(rng.normal(size=len(t)),500+n*35,2850)
            flap=(np.sin(2*np.pi*(205+n*13)*u)+.3*np.sin(2*np.pi*(510+n*19)*u))*np.exp(-u/.018)
            leaf=level*(edge*(.58+.28*np.sin(2*np.pi*(38+n*3)*u))+.15*flap)*env
            angle=(pan+1)*np.pi/4
            x[:,0]+=leaf*np.cos(angle);x[:,1]+=leaf*np.sin(angle)
        for channel in range(2):x[:,channel]=filt(x[:,channel],None,3300)
    elif kind in ('paper_tap','photo_paper'):
        x=grain*(np.exp(-t/.017)+.3*np.exp(-((t-.035)/.014)**2))
        if kind=='photo_paper':x+=filt(white,1100,6200)*.27*np.sin(np.pi*t/duration)**2
        x+=.2*np.sin(2*np.pi*160*t)*np.exp(-t/.015)
    elif kind in ('paper_slide','paper_glide'):
        env=np.sin(np.pi*t/duration)**1.6
        texture=.58+.22*np.sin(2*np.pi*34*t)+.14*np.sin(2*np.pi*73*t)
        x=(.8*grain+.25*soft)*env*texture
    elif kind=='fusion_stream':
        env=np.zeros(len(t))
        flight=event.get('pulse_duration',1.65)
        for start in event.get('pulse_starts',[]):
            q=np.clip((t-start)/flight,0,1)
            env+=np.sin(np.pi*q)**2
        env/=max(1,float(env.max()))
        lower=filt(white,280,950);upper=filt(white,950,2900)
        drift=np.linspace(.1,.75,len(t))
        x=(lower*(1-drift)+upper*drift*.6)*env
    elif kind in ('air_link','soft_bloom','perspective_bloom'):
        env=np.sin(np.pi*t/duration)**1.5
        x=soft*env*.75+grain*env*.1
        if kind!='air_link':
            x+=(np.sin(2*np.pi*146.832*t)+.25*np.sin(2*np.pi*220*t))*env*.035
    elif kind=='warm_boundary':
        x=.35*soft*np.exp(-t/.035)+np.sin(2*np.pi*146.832*t)*np.exp(-t/.058)
    else:raise ValueError('Unknown Foley type: '+kind)
    x=norm(edges(x,event.get('edge_attack',.003),event.get('edge_release',min(.04,duration*.3))))
    return x

def render_foley(direction,duration=114):
    global N
    N=round(duration*SR)
    out=np.zeros((N,2),np.float32)
    send=np.zeros_like(out)
    for index,event in enumerate(direction['events']):
        x=foley_event(event,event.get('seed_index',index))
        gain=event['gain']
        gain*= {'fusion_stream':1.6,'perspective_bloom':1.4,'air_link':1.25}.get(event['type'],1)
        # Contact balance travels with its cue when the picture is re-edited.
        gain*=event.get('contact_gain',1)
        add(out,x,event['time'],gain,event.get('pan',0),event.get('pan_end'))
        add(send,x,event['time'],gain*event.get('room_send',.12),event.get('pan',0),event.get('pan_end'))
    out+=room(send,.22,.65)
    return out
