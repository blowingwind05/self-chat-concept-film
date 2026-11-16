"""Continuous main music and one source-ending transition, with approved Foley.

Music: Origami by Scott Buckley, CC BY 4.0.
Source and permitted use: https://www.scottbuckley.com.au/library/origami/
Music edits: unbroken main passage, one ending crossfade, gain and endpoint fades.
No middle-section cuts, tempo changes, or action-driven music ducking.
The source music is a build input, never distributed as a separate song.
"""
from pathlib import Path
import json,subprocess,re,hashlib,urllib.request,argparse
import numpy as np
from scipy.io import wavfile
import imageio_ffmpeg
from action_effects import render_foley,filt

ROOT=Path(__file__).resolve().parent.parent
WORK=ROOT/'.sound-build'
SR=44100
DURATION=108
MUSIC_GAIN=0.579428696426881
OUTRO_TIMELINE_START=102.0
OUTRO_SOURCE_RANGE=(178.35,184.35)
OUTRO_CROSSFADE=(102.45,103.20)
SOURCE_URL='https://www.scottbuckley.com.au/library/wp-content/uploads/2025/10/Origami.mp3'
FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()

def measure(path):
    result=subprocess.run([FFMPEG,'-hide_banner','-nostats','-i',str(path),'-af',
        'loudnorm=I=-18:TP=-1.5:LRA=8:print_format=json','-f','null','-'],
        capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
    return json.loads(re.findall(r'\{[\s\S]*?\}',result.stderr)[-1])

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--work-dir',type=Path,default=WORK)
    parser.add_argument('--source-audio',type=Path,
        help='Existing original Origami MP3 or decoded original WAV; never an edited music stem.')
    args=parser.parse_args()
    work=args.work_dir.resolve();work.mkdir(exist_ok=True)
    source_path=args.source_audio.resolve() if args.source_audio else work/'Origami-ScottBuckley-original.mp3'
    if args.source_audio:
        if not source_path.exists():raise FileNotFoundError(source_path)
    elif not source_path.exists():
        headers={'User-Agent':'Mozilla/5.0','Accept':'audio/mpeg,*/*',
                 'Referer':'https://www.scottbuckley.com.au/library/'}
        with urllib.request.urlopen(urllib.request.Request(SOURCE_URL,headers=headers),timeout=60) as response:
            source_path.write_bytes(response.read())
    decoded=source_path
    if source_path.suffix.lower()!='.wav':
        decoded=work/'licensed-continuous-source.wav'
        subprocess.run([FFMPEG,'-v','error','-y','-i',str(source_path),'-ar',str(SR),'-ac','2',
            '-c:a','pcm_f32le',str(decoded)],check=True)
    rate,source=wavfile.read(decoded)
    assert rate==SR and source.ndim==2 and source.shape[1]==2
    assert np.issubdtype(source.dtype,np.floating) and len(source)>=round(OUTRO_SOURCE_RANGE[1]*SR)
    music=source[:DURATION*SR].astype(np.float32,copy=True)
    t=np.arange(DURATION*SR)/SR
    music*=np.sin(np.clip(t/.35,0,1)*np.pi/2)[:,None]**2
    music_gain=MUSIC_GAIN
    music*=music_gain
    # Keep the approved main passage sample-identical until the ending join.
    outro=source[round(OUTRO_SOURCE_RANGE[0]*SR):round(OUTRO_SOURCE_RANGE[1]*SR)].astype(np.float32,copy=True)
    outro*=music_gain
    a,b=(round(v*SR) for v in OUTRO_CROSSFADE)
    origin=round(OUTRO_TIMELINE_START*SR)
    p=np.linspace(0,np.pi/2,b-a,dtype=np.float32)
    music[a:b]=music[a:b]*np.cos(p)[:,None]+outro[a-origin:b-origin]*np.sin(p)[:,None]
    music[b:]=outro[b-origin:]
    music*=np.cos(np.clip((t-106.2)/1.8,0,1)*np.pi/2)[:,None]**2

    direction=json.loads((ROOT/'production/foley-cues.json').read_text(encoding='utf-8'))
    assert direction['duration']==DURATION
    effects=render_foley(direction,DURATION)
    for c in range(2):effects[:,c]=filt(effects[:,c],30,12500)
    effects*=3.2352177738982166
    fadein=np.clip((t-.12)/.35,0,1)
    fadeout=np.cos(np.clip((t-(DURATION-1.2))/1.1,0,1)*np.pi/2)**2
    effects*=(fadein*fadeout)[:,None]
    mix=music+effects
    assert np.isfinite(mix).all() and np.max(np.abs(mix))<.9
    master=work/'film-master.wav';wavfile.write(master,SR,mix.astype(np.float32))
    wavfile.write(work/'music-stem.wav',SR,music)
    wavfile.write(work/'foley-stem.wav',SR,effects)
    target=ROOT/'dist/assets/film-soundtrack.mp3'
    subprocess.run([FFMPEG,'-v','error','-y','-i',str(master),'-c:a','libmp3lame','-b:a','256k',
        '-ar',str(SR),'-map_metadata','-1','-metadata',f'title=Origami - {DURATION}-second film edit with source ending',
        '-metadata','artist=Scott Buckley','-metadata','copyright=Music licensed CC BY 4.0; continuous main passage, ending crossfade, fades, gain and original Foley mix',str(target)],check=True)
    report={'duration':DURATION,'sampleRate':SR,'channels':2,'musicTitle':'Origami','musicArtist':'Scott Buckley',
        'license':'CC BY 4.0','source':SOURCE_URL,'sourceAudio':str(source_path),
        'sourceSha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
        'edits':{'continuousMainSourceSeconds':[0,OUTRO_CROSSFADE[0]],
                 'continuousMainSourceSamples':[0,round(OUTRO_CROSSFADE[0]*SR)],
                 'middleSectionCuts':0,'outroSourceSeconds':OUTRO_SOURCE_RANGE,
                 'outroMappingTimelineSeconds':[OUTRO_TIMELINE_START,DURATION],
                 'outroCrossfadeSeconds':OUTRO_CROSSFADE,'outroSourceFinalChord':179.60,
                 'finalChordTimeline':103.25,'playbackRate':1,'ducking':False,
                 'fadeInSeconds':[0,.35],'fadeOutSeconds':[106.2,DURATION]},
        'foleyEvents':len(direction['events']),'effectsBusGain':3.2352177738982166,'musicGain':music_gain,
        'peak':float(np.max(np.abs(mix))),'finalMeasure':measure(target)}
    (work/'mix-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
