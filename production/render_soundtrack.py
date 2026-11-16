"""Original, fully rendered instrumental score and picture-specific Foley.

No speech, external recordings or stock-music loops. The browser receives a
single finished stereo master, rather than synthesizing prompts during frames.
"""
from pathlib import Path
import json, math, sys, subprocess, re, argparse, hashlib
ROOT=Path(__file__).resolve().parent.parent
SOURCE=Path(__file__).resolve().parent
WORK=ROOT/'.sound-build'
WORK.mkdir(parents=True,exist_ok=True)
import numpy as np
from scipy import signal
from scipy.io import wavfile
import imageio_ffmpeg

SR=44100
DURATION=109
N=SR*DURATION
RNG=np.random.default_rng(161116)
MUSIC=np.zeros((N,2),np.float32)
SEND=np.zeros_like(MUSIC)
FOLEY=np.zeros_like(MUSIC)
FOSEND=np.zeros_like(MUSIC)

def norm(x):
    return (x/(np.max(np.abs(x))+1e-9)).astype(np.float32)

def filt(x,low=None,high=None,order=2):
    if low and high:sos=signal.butter(order,[low,high],btype='bandpass',fs=SR,output='sos')
    elif low:sos=signal.butter(order,low,btype='highpass',fs=SR,output='sos')
    else:sos=signal.butter(order,high,btype='lowpass',fs=SR,output='sos')
    return signal.sosfilt(sos,x).astype(np.float32)

def edges(x,attack=.006,release=.045):
    x=x.copy();a=min(len(x),round(attack*SR));r=min(len(x),round(release*SR))
    if a:x[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2
    if r:x[-r:]*=np.cos(np.linspace(0,np.pi/2,r))**2
    return x

def add(bus,x,start,gain=1,pan=0,pan_end=None):
    pos=round(start*SR)
    if pos>=N:return
    if pos<0:x=x[-pos:];pos=0
    x=x[:N-pos];length=len(x)
    if pan_end is None:angle=(np.clip(pan,-1,1)+1)*np.pi/4
    else:angle=(np.linspace(pan,pan_end,length).clip(-1,1)+1)*np.pi/4
    bus[pos:pos+length,0]+=x*np.cos(angle)*gain
    bus[pos:pos+length,1]+=x*np.sin(angle)*gain

def instrument(midi,duration,kind,seed):
    rng=np.random.default_rng(seed)
    f=440*2**((midi-69)/12)
    tail={'felt':.8,'pluck':.4,'bass':.35,'pad':1.5,'brush':0,'kick':.035,'rim':.02,'shaker':.015}.get(kind,.5)
    length=max(.055,duration+tail)
    t=np.arange(round(length*SR),dtype=np.float64)/SR
    if kind=='kick':
        phase=2*np.pi*(54*t+76*.026*(1-np.exp(-t/.026)))
        x=np.sin(phase)*np.exp(-t/.068)*(1-np.exp(-t/.0018))
        x+=filt(rng.normal(size=len(t)),300,1500)*np.exp(-t/.006)*.035
        return edges(x.astype(np.float32),.001,.03)*.31
    if kind=='rim':
        x=(np.sin(2*np.pi*1180*t)+.58*np.sin(2*np.pi*1780*t)+.32*np.sin(2*np.pi*3200*t))*np.exp(-t/.011)
        x+=filt(rng.normal(size=len(t)),1300,7000)*np.exp(-t/.009)*.3
        return edges(x.astype(np.float32),.001,.016)*.105
    if kind=='shaker':
        x=filt(rng.normal(size=len(t)),3900,10500)
        x*=np.sin(np.pi*np.linspace(0,1,len(t)))**.8
        return norm(edges(x,.003,.012))*.10
    if kind=='brush':
        x=filt(rng.normal(size=len(t)),900,3900)
        return norm(edges(x*np.exp(-t/.026),.003,.025))*.065
    if kind=='pad':
        x=np.zeros(len(t))
        for harmonic,amp in [(1,1),(2,.20),(3,.09),(4,.025)]:
            for cents in [-3,2.3]:
                phase=rng.uniform(0,2*np.pi)
                x+=amp*.5*np.sin(2*np.pi*f*harmonic*2**(cents/1200)*t+phase)
        a=min(.9,duration*.3)
        env=(1-np.exp(-t/max(.2,a)))*(1+.03*np.sin(2*np.pi*.19*t))
        env*=np.exp(-np.maximum(t-duration,0)/.58)
        return edges((x*env).astype(np.float32),.06,.8)*.075
    x=np.zeros(len(t))
    if kind=='felt':
        partials=[1,.42,.19,.115,.065,.038,.024,.013,.007]
        for h,amp in enumerate(partials,1):
            stretched=f*h*np.sqrt(1+.00005*h*h)
            tau=(2.1*(220/f)**.10)/(h**.72)
            vibration=(np.cos(2*np.pi*stretched*2**(-1.25/1200)*t)
                       +.82*np.cos(2*np.pi*stretched*2**(1.15/1200)*t+.05)) / 1.82
            x+=amp*vibration*np.exp(-t/tau)
        hammer=filt(rng.normal(size=len(t)),500,4200)*np.exp(-t/.013)*.038
        x=(x+hammer)*(1-np.exp(-t/.007))*np.exp(-np.maximum(t-duration,0)/.24)
        return edges(x.astype(np.float32),.003,.15)*.27
    if kind=='pluck':
        for h in range(1,9):
            amp=np.sin(h*np.pi*.32)/(h**1.3)
            x+=amp*np.cos(2*np.pi*f*h*np.sqrt(1+.00008*h*h)*t+rng.uniform(-.1,.1))*np.exp(-t/(.90/h**.65))
        body=(np.sin(2*np.pi*890*t)+.4*np.sin(2*np.pi*1730*t))*np.exp(-t/.014)*.09
        x=(x+body)*(1-np.exp(-t/.0025))*np.exp(-np.maximum(t-duration,0)/.14)
        return edges(x.astype(np.float32),.002,.09)*.34
    # A rounded plucked bass, with audible harmonics rather than a sub sine.
    for h,amp in [(1,1),(2,.24),(3,.09),(4,.025)]:
        x+=amp*np.sin(2*np.pi*f*h*t+.1)*np.exp(-t/(1.1/h**.6))
    x*=(1-np.exp(-t/.016))*np.exp(-np.maximum(t-duration,0)/.15)
    return edges(x.astype(np.float32),.012,.1)*.29

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
    x=norm(edges(x,.003,min(.04,duration*.3)))
    return x

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--score',type=Path,default=SOURCE/'music-score.json')
    parser.add_argument('--reuse-foley',type=Path)
    parser.add_argument('--reference-music',type=Path)
    args=parser.parse_args()
    score=json.loads(args.score.read_text(encoding='utf-8-sig'))
    direction=json.loads((SOURCE/'foley-cues.json').read_text(encoding='utf-8-sig'))
    notes=score['notes']
    sends={'felt':.38,'pluck':.28,'bass':.075,'pad':.48,'brush':.07,'kick':.025,'rim':.12,'shaker':.03}
    for index,note in enumerate(notes):
        kind=note['instrument'];x=instrument(note['midi'],note['duration'],kind,1500+index)
        gain=note['velocity'];pan=note.get('pan',0)
        pan=float(np.clip(pan*{'felt':3,'pluck':2,'pad':1.6,'bass':0,'brush':1,'kick':0,'rim':1,'shaker':1.2}[kind],-.55,.55))
        add(MUSIC,x,note['time'],gain,pan)
        add(SEND,x,note['time'],gain*sends[kind],pan)
    # Soft breaths are not hard cuts: music carries the edits across scene boundaries.
    envelope=np.ones(N,np.float32)
    for breath in direction['score_breaths']:
        a,b=round(breath['start']*SR),round(breath['end']*SR)
        dip=np.sin(np.linspace(0,np.pi,b-a))**2
        envelope[a:b]*=1-(1-10**(breath['attenuation_db']/20))*dip
    # Brief, picture-led ducking makes contacts legible without loud UI pings.
    for event in direction['events']:
        if 39<=event['time']<46:
            depth=3.5 if event['time']<41 else (1 if event['type']=='photo_paper' else 2.5)
            a=max(0,round((event['time']-.035)*SR));b=min(N,round((event['time']+.30)*SR))
            q=np.linspace(0,1,b-a)
            dip=np.where(q<.15,np.sin(np.minimum(q/.15,1)*np.pi/2)**2,
                         np.cos(np.maximum((q-.15)/.85,0)*np.pi/2)**2)
            envelope[a:b]*=1-(1-10**(-depth/20))*dip
    MUSIC[:]= (MUSIC+room(SEND))*envelope[:,None]
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    music_calibration=float(score.get('render_gain',1.0))
    if args.reference_music:
        probe=WORK/'music-calibration.wav';wavfile.write(probe,SR,MUSIC)
        def loudness(path):
            result=subprocess.run([ffmpeg,'-hide_banner','-nostats','-i',str(path),'-af',
                'loudnorm=I=-18:TP=-1.5:LRA=8:print_format=json','-f','null','-'],
                capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
            return float(json.loads(re.findall(r'\{[\s\S]*?\}',result.stderr)[-1])['input_i'])
        music_calibration=10**((loudness(args.reference_music)-loudness(probe))/20)
    MUSIC[:]*=music_calibration
    if args.reuse_foley:
        rate,retained=wavfile.read(args.reuse_foley)
        assert rate==SR and retained.shape==(N,2)
        FOLEY[:]=retained
    else:
        for index,event in enumerate(direction['events']):
            x=foley_event(event,index)
            gain=event['gain']
            gain*= {'fusion_stream':1.6,'perspective_bloom':1.4,'air_link':1.25}.get(event['type'],1)
            if 39<=event['time']<46:
                gain*=1.65 if event['time']<41 else (.9 if event['type']=='photo_paper' else 1.35)
            add(FOLEY,x,event['time'],gain,event.get('pan',0),event.get('pan_end'))
            add(FOSEND,x,event['time'],gain*.12,event.get('pan',0),event.get('pan_end'))
        FOLEY[:]+=room(FOSEND,.22,.65)
    # High-pass for clean low end; fade the complete production to digital silence.
    mix=MUSIC+FOLEY
    for c in range(2):mix[:,c]=filt(mix[:,c],30,12500)
    time=np.arange(N)/SR
    fadein=np.clip((time-.12)/.35,0,1)
    fadeout=np.cos(np.clip((time-107.8)/1.1,0,1)*np.pi/2)**2
    mix*= (fadein*fadeout)[:,None]
    peak=float(np.max(np.abs(mix)))
    mix*=.70/max(peak,1e-6)
    raw=WORK/'premaster.wav'
    wavfile.write(raw,SR,mix.astype(np.float32))
    wavfile.write(WORK/'music-stem.wav',SR,MUSIC)
    wavfile.write(WORK/'foley-stem.wav',SR,FOLEY)
    # Two-pass BS.1770 loudness mastering, with true-peak headroom.
    command=[ffmpeg,'-hide_banner','-nostats','-i',str(raw),'-af',
             'loudnorm=I=-18:TP=-1.5:LRA=8:print_format=json','-f','null','-']
    result=subprocess.run(command,capture_output=True,text=True,check=True)
    match=re.findall(r'\{[\s\S]*?\}',result.stderr)[-1]
    measure=json.loads(match)
    options=('loudnorm=I=-18:TP=-1.5:LRA=8:linear=true:'+
             'measured_I='+measure['input_i']+':measured_TP='+measure['input_tp']+
             ':measured_LRA='+measure['input_lra']+':measured_thresh='+measure['input_thresh']+
             ':offset='+measure['target_offset']+':print_format=json')
    master=WORK/'film-master.wav'
    result=subprocess.run([ffmpeg,'-hide_banner','-nostats','-y','-i',str(raw),'-af',options,
        '-ar',str(SR),'-c:a','pcm_s24le',str(master)],capture_output=True,text=True,check=True)
    mastering=json.loads(re.findall(r'\{[\s\S]*?\}',result.stderr)[-1])
    target=ROOT/'dist/assets/film-soundtrack.mp3'
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(master),'-c:a',
        'libmp3lame','-b:a','256k','-ar',str(SR),'-map_metadata','-1',
        '-metadata','title=一个只和自己聊天的 App · 原创器乐与动作声轨',str(target)],check=True)
    # A clean extract for reviewing the densest motion/sound passage.
    preview=WORK/'fusion-and-message-preview.mp3'
    subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-ss','29','-i',str(master),
        '-t','17','-c:a','libmp3lame','-b:a','256k',str(preview)],check=True)
    report={'duration':DURATION,'sampleRate':SR,'channels':2,'voiceover':False,
        'noteCount':len(notes),'foleyEvents':len(direction['events']),
        'tempo':score.get('tempo_bpm',score.get('tempo')),'musicCalibration':music_calibration,
        'foleyReused':bool(args.reuse_foley),'foleySamplesHash':hashlib.sha256(FOLEY.tobytes()).hexdigest(),
        'premaster':measure,'mastering':mastering,'audioBytes':target.stat().st_size,
        'endSilencePeak':float(np.max(np.abs(mix[round(108.91*SR):]))),
        'stereoCorrelation':float(np.corrcoef(mix[:,0],mix[:,1])[0,1])}
    (WORK/'production-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
