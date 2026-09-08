"""Build the HYG v4.1 subset: python scripts/import-stars.py /path/to/hygdata_v41.csv.
Input: https://github.com/astronexus/HYG-Database, CC BY-SA 4.0, David Nash.
No invented distances: missing/invalid parallaxes (dist >= 100000 pc) are excluded.
"""
import csv,json,sys,math
from pathlib import Path
stars=[]
for r in csv.DictReader(open(sys.argv[1],encoding='utf-8')):
    distance=float(r['dist'])
    if not 0 < distance < 100000: continue
    def n(k):
        try:
            v=float(r[k]);return v if math.isfinite(v) else None
        except ValueError:return None
    name=r['proper'] or r['bf'].strip() or (('HIP '+r['hip']) if r['hip'] else r['gl'] or 'HYG '+r['id'])
    stars.append([int(r['id']),name,n('ra'),n('dec'),distance,n('mag'),r['spect'],n('ci'),n('lum'),r['hip'],r['hd']])
out={'source':'HYG v4.1 / David Nash / Hipparcos, Yale, Gliese','sourceUrl':'https://github.com/astronexus/HYG-Database','license':'CC BY-SA 4.0','epoch':'J2000','columns':['id','name','raHours','decDegrees','distancePc','magnitude','spectralType','colorIndexBV','luminositySolar','hip','hd'],'excluded':'Sol and distances >= 100000 pc (unknown or dubious parallax)','count':len(stars),'stars':stars}
Path('public/data/stars.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'{len(stars)} stars with catalog distances')
