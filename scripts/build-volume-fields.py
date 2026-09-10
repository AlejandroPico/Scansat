"""Generate continuous pedagogical density grids for volume rendering.
Gaussian initial field and first-order Lagrangian displacements; NOT observed data.
The outer field is a coarse structural illustration, not a catalogue/light cone.
"""
from pathlib import Path
import gzip,json
import numpy as np
from scipy.ndimage import gaussian_filter
out=Path(__file__).resolve().parents[1]/'public/data/cosmography'
for name,n,seed,turnover in [('local-volume',192,941107,9),('cosmic-volume',256,420601,22)]:
 rng=np.random.default_rng(seed);white=rng.normal(size=(n,n,n));wave=np.fft.rfftn(white)
 k=np.fft.fftfreq(n)*n;kz=np.fft.rfftfreq(n)*n
 axes=np.meshgrid(k,k,kz,indexing='ij');k2=sum(a*a for a in axes)
 amp=np.sqrt(np.sqrt(k2+1e-9)/(1+(np.sqrt(k2)/turnover)**2)**2)*np.exp(-k2/(n*.22)**2)
 delta=wave*amp;delta[0,0,0]=0
 psi=np.array([np.fft.irfftn(1j*a*delta/np.maximum(k2,1),s=(n,n,n),axes=(0,1,2)).real for a in axes]);psi*=2.8/np.std(psi)
 pos=(np.indices((n,n,n),dtype=float)+psi)%n;index=np.floor(pos).astype(int)
 density=np.bincount(np.ravel_multi_index(index.reshape(3,-1),(n,n,n)),minlength=n**3).reshape(n,n,n).astype(float)
 density=gaussian_filter(density,.7,mode='wrap')
 # Log encoding preserves tenuous inter-filament matter as well as dense knots.
 encoded=np.round(np.clip(np.log1p(density)/np.log(25),0,1)*255).astype('u1')
 packed=gzip.compress(encoded.tobytes(),mtime=0)
 if name=='cosmic-volume':
  (out/'cosmic-volume.part1.bin.gz').write_bytes(packed[:8000000])
  (out/'cosmic-volume.part2.bin.gz').write_bytes(packed[8000000:])
 else:(out/(name+'.bin.gz')).write_bytes(packed)
 print(name,n,encoded.min(),encoded.max())
(out/'volume-metadata.json').write_text(json.dumps({'version':1,'local':{'file':'local-volume.bin.gz','size':192,'sideMpc':2000},'outer':{'file':'cosmic-volume.bin.gz','size':256,'radiusLy':46.5e9},'encoding':'uint8 log(1+density)/log(25), x fastest for GPU; isotropic generated field','model':'Pedagogical Zel’dovich density; independent coarse outer realization; not a fitted simulation, complete measured map, or light cone.','display':'Continuous volume integration; violet/gold are false-colour density. Soft horizon window and overlapping level-of-detail transitions. Outer grid does not resolve galaxy-scale filaments.'},indent=2)+'\n')
