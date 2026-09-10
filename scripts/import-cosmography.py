"""Rebuild local, attributed cosmography assets. Python 3 + NumPy + SciPy.
Usage: python scripts/import-cosmography.py --cache /path/to/downloads
FITS primary arrays are read without resampling their coordinate conventions.
"""
import argparse, gzip, hashlib, json, struct, urllib.request, zipfile
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates, binary_erosion
from scipy.integrate import cumulative_trapezoid

OUT = Path(__file__).resolve().parents[1] / 'public/data/cosmography'
ROOT = 'https://projets.ip2i.in2p3.fr/cosmicflows/'
SOURCES = {
 'cosmos.bin': 'https://worldwidetelescope.org/wwtweb/catalog.aspx?Q=cosmosnewbin',
 '2mrs-full.tsv': 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/ApJS/199/26/table3&-out.all&-out.max=50000',
 'cf-velocity-ungrouped.fits': ROOT+'CF4_new_64-z008_velocity.fits',
 'cf-basins.zip': ROOT+'CF4_new_128-z008_watersheds-fits.zip',
}

def packed(name, data):
    payload = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
    (OUT/name).write_bytes(gzip.compress(payload, mtime=0))

def fits(data, shape):
    header={}
    for off in range(0,len(data),80):
        card=data[off:off+80].decode('ascii')
        if card[:8].strip()=='END': break
        if card[8:10]=='= ': header[card[:8].strip()]=card[10:].split('/')[0].strip()
    start=((off+80+2879)//2880)*2880
    dimensions=tuple(int(header[f'NAXIS{i}']) for i in range(int(header['NAXIS']),0,-1))
    assert dimensions==shape, (dimensions,shape)
    return np.frombuffer(data,dtype={-32:'>f4',-64:'>f8'}[int(header['BITPIX'])],offset=start,count=np.prod(shape)).reshape(shape).astype(float)

# de Vaucouleurs supergalactic Cartesian -> Galactic -> equatorial J2000 -> scene.
# Basis: SG north pole l=47.37,b=6.32; SG x-axis l=137.37,b=0 degrees.
def sg_to_scene(points):
    l,b=np.deg2rad([47.37,6.32]); north=np.array([np.cos(l)*np.cos(b),np.sin(l)*np.cos(b),np.sin(b)])
    x=np.array([-np.sin(l),np.cos(l),0]); y=np.cross(north,x)
    gal=points@np.stack([x,y,north])
    eq=gal@np.array([[-.0548755604,-.8734370902,-.4838350155],[.4941094279,-.44482963,.7469822445],[-.867666149,-.1980763734,.4559837762]])
    e=np.deg2rad(23.43928)
    return np.column_stack([eq[:,0],eq[:,2]*np.cos(e)-eq[:,1]*np.sin(e),-eq[:,1]*np.cos(e)-eq[:,2]*np.sin(e)])

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--cache',type=Path,required=True);args=parser.parse_args()
    args.cache.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    for name,url in SOURCES.items():
        path=args.cache/name
        if not path.exists():
            with urllib.request.urlopen(url,timeout=120) as r:path.write_bytes(r.read())
    sdss=(args.cache/'cosmos.bin').read_bytes()
    assert len(sdss)%25==0 and len(sdss)>10_000_000
    for _,ra,dec,d,typ,size in struct.iter_unpack('<QfffBf',sdss):
        assert 0<=ra<=24 and -90<=dec<=90 and 0<d<10000 and np.isfinite(size)
    packed('sdss.bin.gz',sdss)
    lines=[l for l in (args.cache/'2mrs-full.tsv').read_text().splitlines() if l and not l.startswith('#')]
    columns=lines[0].split('\t');rows=[]
    z=np.linspace(0,.3,30001);dc=np.concatenate([[0],cumulative_trapezoid(299792.458/73/np.sqrt(.3*(1+z)**3+.7),z)])
    for line in lines[3:]:
        r=dict(zip(columns,[s.strip() for s in line.split('\t')]))
        if not r.get('cz') or float(r['cz'])<=600:continue
        velocity=float(r['cz']);distance=float(np.interp(velocity/299792.458,z,dc))
        rows.append([r['ID'],r['CAT'].replace('_',' '),round(float(r['RAJ2000'])/15,7),float(r['DEJ2000']),round(distance,5),int(velocity),float(r['Kcmag']),r['type'],float(r['b/a'])])
    assert len(rows)>42000
    packed('2mrs.json.gz',rows)
    velocity=fits((args.cache/'cf-velocity-ungrouped.fits').read_bytes(),(3,64,64,64))*52
    basins=fits(zipfile.ZipFile(args.cache/'cf-basins.zip').read('CF4_new_128-z008_BoA.fits'),(128,128,128))
    assert basins[64,64,64]==1
    rng=np.random.default_rng(1729)
    lan=np.argwhere(basins==1)
    seeds=(lan[rng.choice(len(lan),1100,replace=False)][:,::-1]+rng.uniform(-.5,.5,(1100,3))-64)*1000/128
    surround=rng.uniform(-180,180,(900,3));seeds=np.concatenate([seeds,surround])
    indices=np.clip(np.rint(seeds[:,::-1]*128/1000+64).astype(int),0,127)
    labels=basins[tuple(indices.T)]==1
    pos=seeds.copy();active=np.ones(len(pos),bool);segments=[]
    def field(p):
        coords=(p[:,::-1]*64/1000+32).T
        return np.column_stack([map_coordinates(v,coords,order=1,mode='nearest') for v in velocity])
    # RK2 integration of normalized velocity: curves show direction, not travel time.
    for step in range(110):
        v=field(pos);speed=np.linalg.norm(v,axis=1)
        mid=pos+v/np.maximum(speed[:,None],1)*1.0
        v2=field(mid);speed2=np.linalg.norm(v2,axis=1)
        nxt=pos+v2/np.maximum(speed2[:,None],1)*2.0
        active &= (speed>30)&(speed2>30)&(np.max(np.abs(nxt),axis=1)<300)
        # Stop at stagnation points instead of drawing repeated oscillating segments.
        active &= np.sum(v*v2,axis=1)>0
        good=np.where(active)[0]
        if not len(good):break
        a=sg_to_scene(pos[good]/.75);b=sg_to_scene(nxt[good]/.75)
        color=labels[good].astype(float)
        segments.append(np.column_stack([a,color,b,color]).reshape(-1,4))
        pos=nxt
    flows=np.concatenate(segments).astype('<f4');packed('flows.bin.gz',flows.tobytes())
    shell=(basins==1)&~binary_erosion(basins==1)
    edge=np.argwhere(shell);points=(edge[rng.integers(0,len(edge),22000)][:,::-1]+rng.uniform(-.45,.45,(22000,3))-64)*(1000/128)/.75
    boundary=sg_to_scene(points).astype('<f4');packed('laniakea.bin.gz',boundary.tobytes())
    meta={'version':1,'retrieved':'2026-09-08','sdssCount':len(sdss)//25,'twoMrsCount':len(rows),'flowSegments':len(flows)//2,'boundarySamples':len(boundary),
      'sdss':{'recordBytes':25,'layout':'uint64 SDSS id; float32 RA hours, Dec degrees, distance Mpc/h; uint8 WWT morphology bucket; float32 WWT display size. Little endian.','h':.73,'source':SOURCES['cosmos.bin'],'credit':'Sloan Digital Sky Survey / WorldWide Telescope. Catalogue served by WWT; original survey selection retained.'},
      'twoMrs':{'columns':['2MASS ID','alternative name','RA hours','Dec degrees','comoving Mpc','barycentric cz km/s','Ks magnitude','ZCAT morphology','axis ratio'],'H0':73,'OmegaM':.3,'OmegaLambda':.7,'selection':'cz > 600 km/s; no invented distance for missing or negative redshift. No peculiar-velocity correction. Named nearby galaxies are separate reference objects.','credit':'Huchra et al. 2012, ApJS 199,26 / CDS VizieR J/ApJS/199/26','source':SOURCES['2mrs-full.tsv']},
      'flows':{'credit':'Courtois et al. 2023 A&A 670 L15; Dupuy & Courtois 2023 A&A 678 A176 / Cosmicflows-4','source':ROOT,'coordinateUnit':'Mpc, scene frame','h':.75,'grid':'Ungrouped CF4, 64^3 velocity grid over 1000 Mpc/h; basin 1 from 128^3 watershed grid. XYZ velocity components, ZYX array axes.','integration':'RK2 normalized vector field; 2 Mpc/h step; up to 110 steps; gold seed inside Laniakea basin, blue outside. Curves are not galaxy trajectories or density filaments.','uncertainty':'Reconstructed, smoothed present-day peculiar velocity field; boundary is the 2023 watershed solution, not an exact material surface.'},
      'sha256':{n:hashlib.sha256((args.cache/n).read_bytes()).hexdigest() for n in SOURCES}}
    (OUT/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print({k:meta[k] for k in ['sdssCount','twoMrsCount','flowSegments','boundarySamples']})
if __name__=='__main__':main()
