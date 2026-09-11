"""Reproduce published Local Bubble/dust display assets (not synthetic geometry).
Requires numpy, scipy, msgpack. Upstream HTML snapshots stay in the OS temp cache.
"""
import tempfile, urllib.request, re, base64, zlib
from pathlib import Path
import numpy as np, msgpack,json,hashlib
from scipy.spatial import ConvexHull
ROOT=Path(tempfile.gettempdir())/'universal-dust-source';ROOT.mkdir(exist_ok=True)
OUT=Path('public/data/atlas');OUT.mkdir(parents=True,exist_ok=True)
for file,stem in [('distance.html','distance_interactive'),('shell_dust.html','shell_dust')]:
 path=ROOT/file
 if not path.exists():path.write_bytes(urllib.request.urlopen('https://theo-oneill.github.io/localbubble/plots/'+stem+'.html',timeout=120).read())
 text=path.read_text();match=re.search(r"(?:var|let|const)\s+data\s*=\s*['\"]([^'\"]+)['\"]",text)
 if not match:raise ValueError('K3D snapshot missing')
 (ROOT/('distance.uncompressed' if stem=='distance_interactive' else 'shell.uncompressed')).write_bytes(zlib.decompress(base64.b64decode(match.group(1))))
def unpack(name):return msgpack.unpackb((ROOT/name).read_bytes())
def arr(o,k):
 a=o[k];return np.frombuffer(a['data'],dtype=a['dtype']).reshape(a['shape'])
def save(name,a):
 a=np.ascontiguousarray(a)
 if name not in ['local-bubble-radius.f32','nearby-dust-grid.f32']:a.tofile(OUT/name)
 return {'file':name,'dtype':str(a.dtype),'shape':list(a.shape),'bytes':a.nbytes}
p=unpack('distance.uncompressed');o=p['objects'][0];pos=arr(o,'positions')[::64].copy();r=arr(o,'attribute')[::64].copy()
assert np.max(abs(np.linalg.norm(pos,axis=1)-r))<.001
unit=pos/r[:,None];tri=ConvexHull(unit).simplices.copy();v=pos[tri];sgn=np.einsum('ij,ij->i',np.cross(v[:,1]-v[:,0],v[:,2]-v[:,0]),v.mean(axis=1));tri[sgn<0]=tri[sgn<0][:,[0,2,1]]
# Reject triangulation across abrupt radial discontinuities rather than drawing long invented wall faces.
v=pos[tri];keep=np.max(np.linalg.norm(v-np.roll(v,1,axis=1),axis=2),axis=1)<60;tri=tri[keep]
m={'frame':'Heliocentric Galactic Cartesian','units':'pc','axes':{'x':'toward Galactic center l=0 b=0','y':'toward l=90 b=0','z':'toward North Galactic Pole b=90'},'origin':'Sun','sourcePaper':'https://arxiv.org/html/2403.04961v2','sourceDataDOI':'https://doi.org/10.7910/DVN/INB1RB','attribution':"O’Neill, Zucker, Goodman & Edenhofer (2024), The Local Bubble is a Local Chimney; underlying Edenhofer et al. (2024) 3D dust map.",'surface':{'source':'https://theo-oneill.github.io/localbubble/plots/distance_interactive.html','sourcePoints':786392,'sampling':'Every 64th point in author HEALPix-ordered K3D figure. Coordinates retained unchanged as float32. Triangles constructed on normalized directions; faces with an edge over 60 pc removed. Mesh is visualization interpolation of sampled measured/modelled positions.','positions':save('local-bubble-positions.f32',pos.astype('<f4')),'distance':save('local-bubble-radius.f32',r.astype('<f4')),'triangles':save('local-bubble-triangles.u32',tri.astype('<u4')),'limits':'Dust-based reconstructed peak-extinction surface, not exact physical gas boundary. Low density chimney has larger uncertainty; no inferred structure inside 69 pc.'}}
p=unpack('shell.uncompressed');o=p['objects'][0];v=arr(o,'volume');assert v.shape==(261,261,261)
# 3x3x3 block averages of original 5 pc sampled author volume. K3D storage is [z,y,x].
grid=v.reshape(87,3,87,3,87,3).mean(axis=(1,3,5)).astype('<f4')
# Preserve original displayed volume mapping: texture spans [-650,+650] in each axis.
cell=1300/87;coords=-650+(np.arange(87)+.5)*cell
zz,yy,xx=np.meshgrid(coords,coords,coords,indexing='ij');rad=np.sqrt(xx*xx+yy*yy+zz*zz)
valid=np.isfinite(grid)&(rad>=69)&(rad<=650)
# Context points emphasize denser sampled cells; optional volume file retains all means.
mask=valid&(grid>=.3)
pts=np.stack((xx[mask],yy[mask],zz[mask],grid[mask]),axis=1).astype('<f4')
m['dust']={'source':'https://theo-oneill.github.io/localbubble/plots/shell_dust.html','sourceObject':'3D Dust','sourceShapeZYX':[261,261,261],'sampling':'Arithmetic mean of each nonoverlapping 3x3x3 block of author 5 pc figure voxels, resulting 87^3 grid. Point representation keeps finite values >=0.3 and heliocentric radius 69–650 pc. No random placement/jitter. Coordinates use exact published K3D texture bounds; roughly 15 pc effective resolution.','boundsXYZ':[[-650,650],[-650,650],[-650,650]],'gridOrder':'C-order [z,y,x]; x varies fastest','grid':save('nearby-dust-grid.f32',grid),'pointsXYZvalue':save('nearby-dust-points.f32',pts),'valueMeaning':'Unmodified density/intensity values from published visualization; use relative opacity/color rather than a calibrated numeric legend.','pointThreshold':.3,'limits':'Edenhofer map reconstruction, not a photograph. Region within 69 pc unmeasured by this map; outer displayed radius cropped to 650 pc. Coarse visualization loses fine clouds. Colors and point opacity are display choices.'}
m['sourceChecksums']={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in ['distance.html','shell_dust.html']}
(OUT/'dust-provenance.json').write_text(json.dumps(m,indent=2))
print(json.dumps({'surfacePoints':len(pos),'triangles':len(tri),'dustPoints':len(pts),'files':[(f.name,f.stat().st_size) for f in OUT.iterdir()]},indent=2))
