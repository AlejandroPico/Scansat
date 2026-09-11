"""DESI DR1 public redrock sample: deterministic HEALPix selection, never synthetic.
Requires astropy/numpy. Run manually; no live upstream queries in site builds.
"""
import urllib.request,re,io,json,pathlib,concurrent.futures
import numpy as np
from astropy.io import fits
from astropy.cosmology import FlatLambdaCDM
root='https://data.desi.lbl.gov/public/dr1/spectro/redux/iron/healpix/main/dark/'
def get(url):return urllib.request.urlopen(url,timeout=60).read()
def dirs(url):return sorted(int(x) for x in re.findall(r'href="(\d+)/"',get(url).decode()))
groups=dirs(root); selected=[groups[int(i)] for i in np.linspace(0,len(groups)-1,32)]
def sample(group):
 directory=f'{root}{group}/'; pixels=dirs(directory);pixel=pixels[len(pixels)//2]
 url=f'{directory}{pixel}/redrock-main-dark-{pixel}.fits'
 with fits.open(io.BytesIO(get(url))) as h:
  z=h['REDSHIFTS'].data;f=h['FIBERMAP'].data
  assert np.array_equal(z['TARGETID'],f['TARGETID'])
  m=(z['SPECTYPE']=='GALAXY')&(z['ZWARN']==0)&(z['DELTACHI2']>25)&(z['Z']>.005)&(z['Z']<2)&(f['COADD_FIBERSTATUS']==0)
  rows=[[str(int(t)),round(float(ra),7),round(float(dec),7),round(float(red),7)] for t,ra,dec,red in zip(z['TARGETID'][m],f['TARGET_RA'][m],f['TARGET_DEC'][m],z['Z'][m])]
  print(pixel,len(rows),flush=True);return url,rows
results=list(concurrent.futures.ThreadPoolExecutor(max_workers=4).map(sample,selected));rows=[r for _,rs in results for r in rs];rows=list({r[0]:r for r in rows}.values())
cosmo=FlatLambdaCDM(H0=70,Om0=.3);distance=cosmo.comoving_distance(np.array([r[3] for r in rows])).value
for row,d in zip(rows,distance):row.append(round(float(d),6))
metadata={'release':'DESI DR1 / iron','sourceUrl':'https://data.desi.lbl.gov/doc/releases/dr1/','credit':'DESI Collaboration / US DOE / LBNL','selection':'32 evenly spaced directory groups (numeric order), middle available HEALPix in each. GALAXY; ZWARN=0; DELTACHI2>25; COADD_FIBERSTATUS=0; 0.005<z<2. Not statistically representative or complete coverage.','frame':'ICRS J2000','units':['string TARGETID','deg RA','deg Dec','redshift','Mpc comoving'],'cosmology':{'H0':70,'Om0':.3,'flat':True},'sources':[u for u,_ in results],'rows':rows,'count':len(rows)}
pathlib.Path('public/data/atlas/desi.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n');print('TOTAL',len(rows),flush=True)
