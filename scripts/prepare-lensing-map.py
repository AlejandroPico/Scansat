"""Render the observed-constrained CATS v4.1 convergence map as relative color.
κ is projected TOTAL mass, not an isolated dark matter density or 3D volume.
"""
import urllib.request,io,json,pathlib
import numpy as np
from astropy.io import fits
from PIL import Image
url='https://archive.stsci.edu/pub/hlsp/frontier/abell2744/models/cats/v4.1/hlsp_frontier_model_abell2744_cats_v4.1_kappa.fits'
p=pathlib.Path('/tmp/universal-atlas-lensing.fits')
raw=p.read_bytes() if p.exists() else urllib.request.urlopen(url,timeout=60).read()
h=fits.open(io.BytesIO(raw))[0];a=h.data.astype(float)
# North is up in the image; FITS array row zero is south.
a=np.flipud(a);v=np.log1p(np.maximum(a,0));v=np.clip((v-np.log1p(.03))/(np.log1p(3)-np.log1p(.03)),0,1)
rgb=np.stack([.12+.88*v,.06+.76*v**1.6,.32+.58*np.sin(v*np.pi/2),np.clip(v*.85,0,.85)],axis=-1)
Image.fromarray(np.uint8(rgb*255),'RGBA').resize((512,512),Image.Resampling.LANCZOS).save('public/atlas/abell2744-kappa.png')
pathlib.Path('public/data/atlas/lensing.json').write_text(json.dumps({'sourceUrl':url,'documentation':'https://archive.stsci.edu/prepds/frontier/lensmodels/','credit':'CATS / Jauzac et al. / LENSTOOL / Hubble Frontier Fields','meaning':'Convergence κ: projected TOTAL mass inferred from lensing; not pure dark matter. Relative display, not calibrated photometry.','stretch':'log1p, κ range .03 to 3, clipped; alpha follows relative value. North-up row reversal and Lanczos reduction 2000² to 512².','center':[h.header['CRVAL1'],h.header['CRVAL2']],'fovDeg':abs(h.header['CDELT1'])*a.shape[1],'frame':'FK5 J2000 TAN','cosmology':{'H0':70,'Om0':.3,'Ode0':.7}},indent=2))
