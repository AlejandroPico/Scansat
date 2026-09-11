"""Reproduce the atlas snapshot: python3 scripts/prepare-nebula-catalog.py INPUT_DIR.

INPUT_DIR contains wise.csv (WISE_HII_V3.0.csv) and pn.tsv (VizieR
J/A+A/656/A110, -out.all, -out.max=unlimited). No inferred group distances.
"""
import csv, gzip, hashlib, json, math, pathlib, sys

root = pathlib.Path(__file__).resolve().parents[1]
inputs = pathlib.Path(sys.argv[1])
def number(v):
    try:
        n = float(v)
        return round(n, 7) if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None

rows = []
for r in csv.DictReader((inputs / 'wise.csv').open()):
    d, error = number(r['Distance']), number(r['e_Distance'])
    # Tiny values can be the kinematic solver floor, not nearby HII regions.
    usable = d is not None and d > .1 and bool(r['DMethod'])
    rows.append(['wise-' + r['WISE_Name'], r['WISE_Name'],
        '; '.join(dict.fromkeys(x.strip() for x in r['All_Names'].split(';') if x.strip())),
        number(r['RA (J2000)']), number(r['Dec (J2000)']), number(r['Radius']),
        d * 1000 if usable else None, 'HII', r['Catalog'], 0,
        r['DMethod'], r['DAuthor'], error * 1000 if error is not None else None,
        None, None, None, d * 1000 if d is not None else None])

lines = [x for x in (inputs / 'pn.tsv').read_text().splitlines() if x and not x.startswith('#')]
for original in csv.DictReader(lines[:1] + lines[3:], delimiter='\t'):
    r = {k: v.strip() for k, v in original.items()}
    d, reliability = number(r['rcomb']), number(r['Rel'])
    # Jacoby SMC 16 is extragalactic; do not place it in the Milky Way.
    if r['PNG'] == 'J16':
        continue
    # Helix already has its dedicated observed image and reference distance.
    if r['Name'].replace(' ', '') == 'NGC7293':
        continue
    usable = d is not None and d > 0 and reliability is not None and reliability > .8
    rows.append(['pn-' + r['PNG'], r['Name'] or 'PN G' + r['PNG'],
        'PN G' + r['PNG'] + '; ' + r['SimbadName'],
        number(r['pnRAdeg']), number(r['pnDEdeg']), number(r['pnRad']),
        d if usable else None, 'PN', r['pnStat'], 1,
        'Gaia EDR3 + prior estadístico', 'Chornay & Walton (2021)', None,
        number(r['b_rcomb']), number(r['B_rcomb']), reliability, d])

data = {'schema': 1, 'columns': ['id','name','aliases','raDeg','decDeg','radiusArcsec',
    'distancePc','type','status','sourceIndex','method','author','errorPc',
    'lowerPc','upperPc','reliability','publishedDistancePc'],
    'sources': [
        {'name':'WISE HII v3.0 · Anderson et al.', 'url':'https://astro.phys.wvu.edu/wise/',
         'download':'https://astro.phys.wvu.edu/wise/WISE_HII_V3.0.csv'},
        {'name':'Chornay & Walton 2021 · Gaia EDR3 / HASH / CDS',
         'url':'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/656/A110',
         'download':'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/A%2bA/656/A110&-out.max=unlimited&-out.all'}],
    'inputSha256': {p: hashlib.sha256((inputs / p).read_bytes()).hexdigest() for p in ['wise.csv','pn.tsv']},
    'notes': 'Registros de dos catálogos, no censo completo ni objetos únicos entre catálogos. Radios angulares en segundos de arco. Distancias heliocéntricas en pc. WISE: distancia individual >100 pc con método publicado; no se hereda distancia de grupo. PN: fiabilidad de asociación >0.8; intervalo 16–84%. Candidatas identificadas como tales. Sin distancia utilizable: solo ficha celeste.',
    'rows': rows}
out = root / 'public/data/atlas/nebula-catalog.json.gz'
out.write_bytes(gzip.compress(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
print(json.dumps({'records': len(rows), 'located': sum(r[6] is not None for r in rows),
    'confirmedLocated': sum(r[6] is not None and r[8] in ('K','T') for r in rows),
    'bytes': out.stat().st_size}))
