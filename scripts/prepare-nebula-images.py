"""Redownload the observed DSS2 fields, preserving their TAN WCS.

Run manually, not on every build. The small JPEGs are tracked in Git.
Credits/conditions: https://archive.stsci.edu/dss/acknowledging.html
"""
import concurrent.futures, json, pathlib, urllib.parse, urllib.request
root = pathlib.Path(__file__).resolve().parents[1]
items = json.loads((root / 'public/data/atlas/nebula-featured.json').read_text())
q = urllib.parse.urlencode(dict(hips='CDS/P/DSS2/color', width=768, height=768,
    fov=2.4, projection='TAN', coordsys='icrs', ra=161.2855417,
    dec=-59.8666944, rotation_angle=0, format='jpg'))
items.append(dict(file='atlas/carina.jpg', url='https://alasky.cds.unistra.fr/hips-image-services/hips2fits?' + q))
def download(item):
    data = urllib.request.urlopen(item['url'], timeout=90).read()
    if not data.startswith(b'\xff\xd8\xff') or len(data) < 10000:
        raise ValueError('Invalid DSS2 JPEG: ' + item['file'])
    (root / 'public' / item['file']).write_bytes(data)
    return item['file'], len(data)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for result in pool.map(download, items):
        print(*result)
