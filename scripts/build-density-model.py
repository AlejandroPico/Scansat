"""Deterministic pedagogical Zel'dovich density model, NOT Millennium data.
Python + NumPy + SciPy. Correlation lengths are fixed in Mpc; the large volume
is homogeneous statistically, not a scaled-up copy of one enormous filament.
"""
from pathlib import Path
import gzip,json
import numpy as np
from scipy.ndimage import gaussian_filter,map_coordinates
OUT=Path(__file__).resolve().parents[1]/'public/data/cosmography'
OUT.mkdir(exist_ok=True,parents=True)
rng=np.random.default_rng(941107);n=160;box=2000.;step=box/n
white=rng.normal(size=(n,n,n));wave=np.fft.rfftn(white)
k=np.fft.fftfreq(n)*n;kz=np.fft.rfftfreq(n)*n
kx,ky,kzz=np.meshgrid(k,k,kz,indexing='ij');k2=kx*kx+ky*ky+kzz*kzz
# Smooth CDM-like turnover, no claim of a fitted cosmological power spectrum.
amp=np.sqrt(np.sqrt(k2+1e-9)/(1+(np.sqrt(k2)/7)**2)**2)*np.exp(-k2/900)
delta=wave*amp;delta[0,0,0]=0
psi=np.array([np.fft.irfftn(1j*kk*delta/np.maximum(k2,1),s=(n,n,n),axes=(0,1,2)).real for kk in [kx,ky,kzz]])
psi*=3.4/np.std(psi)
q=np.indices((n,n,n),dtype=float)
x=(q+psi)%n
idx=np.floor(x).astype(int);density=np.bincount(np.ravel_multi_index(idx.reshape(3,-1),(n,n,n)),minlength=n**3).reshape(n,n,n).astype(float)
density=gaussian_filter(density,.7,mode='wrap')
# Importance sampling emphasizes density without making straight graph edges.
weight=np.maximum(density-.35,.001)**1.55
chosen=rng.choice(n**3,650000,p=(weight/weight.sum()).ravel())
points=np.column_stack(np.unravel_index(chosen,(n,n,n))).astype(float)+rng.uniform(-.5,.5,(len(chosen),3))
p=(points-n/2)*step
r=np.linalg.norm(p,axis=1);keep=(r<950)&(r>180)
p=p[keep];d=density.ravel()[chosen][keep]
values=np.column_stack([p,np.clip(np.log1p(d)/np.log(18),0,1)]).astype('<f4')
(OUT/'density.bin.gz').write_bytes(gzip.compress(values.tobytes(),mtime=0))
# Unresolved outer structure: compact groups with a fixed 12 Mpc dispersion,
# uniformly distributed group centres; no super-horizon scaled voids.
centres=rng.normal(size=(160000,3));centres/=np.linalg.norm(centres,axis=1)[:,None]
outerMpc=46.5e9/3.261563777e6
centres*=rng.uniform((950/outerMpc)**3,1,len(centres))[:,None]**(1/3)*outerMpc
p=np.repeat(centres,3,axis=0)+rng.normal(0,12,(len(centres)*3,3));r=np.linalg.norm(p,axis=1)
p=p[(r>950)&(r<outerMpc)]
values2=np.column_stack([p,rng.uniform(.12,.60,len(p))]).astype('<f4')
(OUT/'outer-density.bin.gz').write_bytes(gzip.compress(values2.tobytes(),mtime=0))
meta={'seed':941107,'model':'First-order Lagrangian (Zel’dovich) displacement from a Gaussian field; CDM-like illustrative spectrum, not fitted or constrained by observations. Importance-sampled density tracers, not individual galaxies.','boxMpc':box,'grid':n,'innerSamples':len(values),'outerSamples':len(values2),'outerModel':'Statistically homogeneous group centres with 12 Mpc dispersion. Unresolved structures become a smooth distribution at horizon scale.','radiusLy':46.5e9,'reference':'https://academic.oup.com/mnras/article/437/4/3442/1005676','color':'False-colour density: violet low, warm high. Not visible-light colour.','limitations':'No N-body evolution, baryon physics, cosmological light cone or measured unobserved galaxies.'}
(OUT/'density-metadata.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n')
print(meta['innerSamples'],meta['outerSamples'])
