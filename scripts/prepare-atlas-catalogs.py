"""Rebuild small, credited public snapshots for the Universal layer atlas.
Run with Python 3; requests are sequential to respect JPL API usage policy.
"""
import csv, io, json, pathlib, urllib.request, urllib.parse, datetime
OUT=pathlib.Path('public/data/atlas');OUT.mkdir(parents=True,exist_ok=True)
def fetch(url):
 return urllib.request.urlopen(url,timeout=60).read()
def save(name,data):
 (OUT/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
names=[('ceres','Ceres','1',473,'#b7afa0','dwarf'),('pluto','Plutón','134340',1188.3,'#c3ada0','dwarf'),('eris','Eris','136199',1163,'#e0d9d1','dwarf'),('haumea','Haumea','136108',780,'#d6d2c6','dwarf'),('makemake','Makemake','136472',715,'#b49177','dwarf'),('vesta','Vesta','4',262.7,'#b1aaa0','asteroid'),('pallas','Palas','2',256,'#b5b1a8','asteroid'),('sedna','Sedna','90377',498,'#ad7765','minor')]
objects=[]
for id,name,sstr,radius,color,kind in names:
 url='https://ssd-api.jpl.nasa.gov/sbdb.api?'+urllib.parse.urlencode({'sstr':sstr,'phys-par':'true','full-prec':'true'})
 d=json.loads(fetch(url));els={x['name']:float(x['value']) for x in d['orbit']['elements']}
 objects.append(dict(id=id,name=name,parent='sun',radiusKm=radius,color=color,type=kind,elements=els,epoch=float(d['orbit']['epoch']),source='JPL SBDB · elementos osculadores J2000',sourceUrl=url,summary=f'{name}: órbita kepleriana aproximada a partir de elementos osculadores JPL SBDB de época JD {d["orbit"]["epoch"]}. No incluye perturbaciones planetarias; el reloj ilustra el movimiento, no ofrece una efeméride operacional. Radio medio aproximado; superficie esquemática sin textura observada.'+(' Haumea es alargado: se usa una esfera de radio equivalente.' if id=='haumea' else '')))
 print('JPL',name,flush=True)
save('minor-bodies.json',objects)
streams=[]
for name,ref in [('GD-1','pricewhelan2018'),('Pal5','pricewhelan2019'),('Sagittarius','antoja2020')]:
 url=f'https://raw.githubusercontent.com/cmateu/galstreams/main/galstreams/tracks/track.st.{name}.{ref}.ecsv'
 data=fetch(url).decode();rows=list(csv.DictReader(io.StringIO('\n'.join(l for l in data.splitlines() if not l.startswith('#')))))
 points=[[float(x[k]) for k in ['ra','dec','distance']] for x in rows if all(x.get(k) not in [None,'','nan'] for k in ['ra','dec','distance'])]
 stride=max(1,len(points)//1800);points=points[::stride]
 streams.append(dict(id='stream-'+name.lower(),name={'Pal5':'Palomar 5','Sagittarius':'Sagitario'}.get(name,name),points=points,frame='ICRS',units=['deg','deg','kpc'],source='galstreams · Mateu 2023 · '+ref,sourceUrl=url,kind='track',note='Trayectoria media publicada; no son estrellas individuales ni órbitas temporales. Muestreo reducido para visualización.'))
 print('Stream',name,len(points),flush=True)
save('streams.json',streams)
(OUT/'galstreams-LICENSE.txt').write_bytes(fetch('https://raw.githubusercontent.com/cmateu/galstreams/main/LICENSE'))
