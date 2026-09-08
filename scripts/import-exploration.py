"""Import GCAT deep-space payloads and landing/impact records (CC BY 4.0).
Usage: python scripts/import-exploration.py /path/to/deepcat.tsv /path/to/landercat.tsv
Source: https://planet4589.org/space/gcat/ — Jonathan C. McDowell.
These are catalog events, never current ephemerides.
"""
import csv,json,sys,datetime,re
from pathlib import Path
source='https://planet4589.org/space/gcat/'
def rows(path):
    return [{k:v.strip() for k,v in r.items()} for r in csv.DictReader((l for l in open(path) if not l.startswith('# Updated')),delimiter='\t')]
def date(s):
    m=re.match(r'(\d{4}) (\w{3})\s+(\d{1,2})',s)
    if not m:return None
    return datetime.datetime.strptime(' '.join(m.groups()),'%Y %b %d').strftime('%Y-%m-%dT00:00:00Z')
def coord(s):
    try:return float(s.replace('?',''))
    except ValueError:return None
worlds={'Luna':'moon','Mars':'mars','Venus':'venus','Titan':'titan','Phobos':'phobos','Jupiter':'jupiter','Mercury':'mercury','Saturn':'saturn','Earth':'earth'}
missions=[];seen=set()
for r in rows(sys.argv[1]):
    if not r['Type'].startswith('P') or r['#JCAT'] in seen:continue
    seen.add(r['#JCAT'])
    missions.append(dict(id='gcat-'+r['#JCAT'],name=r['Name'],aliases=r['PLName']+' '+r['AltNames'],kind='history',agency=r['Owner'],launchDate=date(r['LDate']),launchText=r['LDate'],designation=r['Piece'],destination=r['Dest'],parent=worlds.get(r['Dest']),source='GCAT · J. McDowell',sourceUrl=source,color='#abbcd9',summary=f"Registro histórico de carga útil de espacio profundo {r['#JCAT']}. Designación {r['Piece']}; lanzamiento {r['LDate']}; propietario de catálogo {r['Owner']}. Primera fase de espacio profundo: cuerpo central {r['Primary']}, destino consignado {r['Dest']}. Estos campos documentan esa fase, no la ubicación ni el estado operativo actual.",noLocation=True))
sites=[]
for i,r in enumerate(rows(sys.argv[2])):
    lat,lon=coord(r['Lat']),coord(r['Lon']);body=worlds.get(r['World']);typ=r['LType']
    summary=f"Registro GCAT de aterrizaje, impacto o entrada: {r['Name']}, {r['World']}. Fecha del evento: {r['LandDate']}. "
    summary+=f"Tipo de evento GCAT: {typ}; código de estado: {r['Status']}. "
    if r['Comment']!='-':summary+='Nota original de catálogo: '+r['Comment']+'. '
    summary+='El marcador identifica el lugar del evento; no implica que el vehículo continúe intacto u operativo. Las coordenadas conservan la precisión e incertidumbre del catálogo.'
    sites.append(dict(id='gcat-landing-'+r['#JCAT']+'-'+str(i),name=r['Name'],aliases=r['Comment']+' '+r['LSite'],body=body,world=r['World'],lat=lat,lon=lon,kind='rover' if typ=='RO' else 'landing',component=typ in ['C','R','H','AV','AX'],eventType=typ,status='Registro de superficie · '+r['Status'],agency=r['Owner'],source='GCAT · J. McDowell',sourceUrl=source,launchDate=date(r['LaunchDate']),landDate=date(r['LandDate']),eventDate=r['LandDate'],designation=r['Piece'],summary=summary,color='#edc993' if typ in ['L','RO','LP','LR'] else '#c38d83',noLocation=body is None or lat is None or lon is None))
output={'source':source,'credit':'Data from GCAT (J. McDowell, planet4589.org/space/gcat)','license':'CC BY 4.0','snapshot':'2026-09-08','missions':missions,'sites':sites}
Path('public/data/exploration.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
print(len(missions),'deep-space payload records;',len(sites),'landing / impact records;',sum(not x['noLocation'] for x in sites),'locatable sites')
