"""Published maximal spheres; select 48 largest with edge=0 (no boundary flag).
Source: Douglass, Veyrat & BenZvi (2023), VAST SDSS DR7 v1.3, CC BY 4.0.
"""
import urllib.request,pathlib,json
url='https://zenodo.org/api/records/7406035/files/VoidFinder-nsa_v1_0_1_Planck2018_comoving_maximal.txt/content'
cache=pathlib.Path('/tmp/universal-atlas-void-maximal.txt')
text=cache.read_text() if cache.exists() else urllib.request.urlopen(url,timeout=60).read().decode()
rows=[];h=.674
for line in text.splitlines():
 if not line.strip() or line.startswith('#'):continue
 x,y,z,r,void,edge,d,ra,dec,reff=map(float,line.split())
 if int(edge)==0:rows.append([str(int(void)),ra,dec,d/h,r/h])
rows=sorted(rows,key=lambda r:-r[4])[:48]
data={'credit':'Douglass, Veyrat & BenZvi 2023 · VAST SDSS DR7 v1.3','sourceUrl':'https://doi.org/10.5281/zenodo.7406035','downloadUrl':url,'paper':'https://arxiv.org/abs/2202.01226','license':'CC BY 4.0','h':h,'units':['void ID','RA deg','Dec deg','Mpc comoving','Mpc maximal sphere radius'],'selection':'48 largest maximal spheres with edge=0. Convert all h^-1 Mpc by h=.674. This is not the effective radius and does not describe the full union of spheres of each void.','description':'Esfera máxima de un vacío del catálogo VAST SDSS DR7 v1.3. Selección de los 48 mayores con edge=0, excluyendo indicadores de borde. El radio delimita la esfera máxima inscrita, no la frontera exacta ni el radio efectivo del vacío completo. Distancias comóviles publicadas, h=0,674. Las galaxias SDSS/2MRS muestran el contexto: no son exactamente la misma selección NSA empleada para encontrar estos vacíos.','rows':rows}
pathlib.Path('public/data/atlas/voids.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');print(len(rows))
