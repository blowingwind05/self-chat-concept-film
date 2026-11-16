"""Edit licensed music to picture and retain the approved action-sound design.

Music: Origami by Scott Buckley, CC BY 4.0.
Source and permitted use: https://www.scottbuckley.com.au/library/origami/
Edits: selection, an outro crossfade, fades, gain and original action-sound mix.
The source music is a build input and is never distributed as a separate song.
"""
from pathlib import Path
import json,sys,subprocess,re,hashlib,urllib.request,argparse
import numpy as np
from scipy.io import wavfile
import imageio_ffmpeg
from action_effects import render_foley,filt

ROOT=Path(__file__).resolve().parent.parent
WORK=ROOT/'.sound-build'
SR=44100
DURATION=106
SOURCE_URL='https://www.scottbuckley.com.au/library/wp-content/uploads/2025/10/Origami.mp3'
SOURCE=WORK/'Origami-ScottBuckley-original.mp3'
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()

def measure(path):
    result=subprocess.run([FFMPEG,'-hide_banner','-nostats','-i',str(path),'-af',
        'loudnorm=I=-18:TP=-1.5:LRA=8:print_format=json','-f','null','-'],
        capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
    return json.loads(re.findall(r'\{[\s\S]*?\}',result.stderr)[-1])

def main():
    global WORK,SOURCE
    parser=argparse.ArgumentParser()
    parser.add_argument('--work-dir',type=Path,default=WORK)
    args=parser.parse_args()
    WORK=args.work_dir.resolve()
    SOURCE=WORK/'Origami-ScottBuckley-original.mp3'
    WORK.mkdir(exist_ok=True)
    if not SOURCE.exists():
        headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36','Accept':'audio/mpeg,*/*;q=0.8',
                 'Referer':'https://www.scottbuckley.com.au/library/'}
        with urllib.request.urlopen(urllib.request.Request(SOURCE_URL,headers=headers),timeout=60) as response:
            SOURCE.write_bytes(response.read())
    decoded=WORK/'licensed-source.wav'
    subprocess.run([FFMPEG,'-v','error','-y','-i',str(SOURCE),'-ar',str(SR),'-ac','2',
        '-c:a','pcm_f32le',str(decoded)],check=True)
    rate,source=wavfile.read(decoded)
    assert rate==SR and len(source)/SR>184.23
    # Keep the song's own opening/build and its natural closing phrase. The
    # equal-power outro edit sits across the film's final chapter transition.
    music=source[:DURATION*SR].copy()
    start=100*SR
    outro=source[round(178.23*SR):round(184.23*SR)]
    assert len(outro)==6*SR
    overlap=round(1.6*SR)
    p=np.linspace(0,np.pi/2,overlap,dtype=np.float32)
    music[start:start+overlap]=music[start:start+overlap]*np.cos(p)[:,None]+outro[:overlap]*np.sin(p)[:,None]
    music[start+overlap:]=outro[overlap:]
    # Transparent level dips leave close contacts audible without changing them.
    direction=json.loads((ROOT/'production/foley-cues.json').read_text(encoding='utf-8'))
    envelope=np.ones(len(music),np.float32)
    for event in direction['events']:
        if event['type'] not in ('felt_arrival','paper_tap','photo_paper','felt_low','soft_settle'):continue
        a=max(0,round((event['time']-.025)*SR));b=min(len(music),round((event['time']+.24)*SR))
        q=np.linspace(0,1,b-a)
        dip=np.where(q<.12,np.sin(np.minimum(q/.12,1)*np.pi/2)**2,
                     np.cos(np.maximum((q-.12)/.88,0)*np.pi/2)**2)
        envelope[a:b]*=1-(1-10**(-2.6/20))*dip
    t=np.arange(len(music))/SR
    envelope*=np.sin(np.clip(t/.32,0,1)*np.pi/2)**2
    envelope*=np.cos(np.clip((t-105.2)/.7,0,1)*np.pi/2)**2
    music*=envelope[:,None]
    temp=WORK/'music-unscaled.wav';wavfile.write(temp,SR,music)
    music_gain=10**((-19.0-float(measure(temp)['input_i']))/20)
    music*=music_gain
    effects=render_foley(direction,DURATION)
    for c in range(2):effects[:,c]=filt(effects[:,c],30,12500)
    # Preserve the level of the previously approved effects bus.
    effects*=3.2352177738982166
    fadein=np.clip((t-.12)/.35,0,1)
    fadeout=np.cos(np.clip((t-104.8)/1.1,0,1)*np.pi/2)**2
    effects*=(fadein*fadeout)[:,None]
    mix=music+effects
    assert np.isfinite(mix).all()
    assert np.max(np.abs(mix))<.90,'Unexpected peak: lower music only before mastering.'
    master=WORK/'film-master.wav';wavfile.write(master,SR,mix.astype(np.float32))
    wavfile.write(WORK/'music-stem.wav',SR,music)
    wavfile.write(WORK/'foley-stem.wav',SR,effects)
    target=ROOT/'dist/assets/film-soundtrack.mp3'
    subprocess.run([FFMPEG,'-v','error','-y','-i',str(master),'-c:a','libmp3lame','-b:a','256k',
        '-ar',str(SR),'-map_metadata','-1','-metadata','title=Origami - project film edit',
        '-metadata','artist=Scott Buckley','-metadata','copyright=Music licensed CC BY 4.0; edited and mixed for this film',str(target)],check=True)
    report={'duration':DURATION,'sampleRate':SR,'channels':2,'musicTitle':'Origami','musicArtist':'Scott Buckley',
        'license':'CC BY 4.0','source':SOURCE_URL,'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'edits':{'main':[0,101.6],'outro':[178.23,184.23],'crossfade':[100,101.6]},
        'foleyEvents':len(direction['events']),'effectsBusGain':3.2352177738982166,'musicGain':music_gain,
        'peak':float(np.max(np.abs(mix))),'finalMeasure':measure(target)}
    (WORK/'mix-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
