"""Render the six-section Markdown design as self-contained print HTML.

No third-party packages are needed. Mermaid sources remain in the Markdown;
the print edition uses equivalent static SVG diagrams for offline viewing.
"""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'docs/music-architecture.md').read_text(encoding='utf-8')

def inline(text):
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<a href="\2">\1</a>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'`([^`]+)`', r'<code>\1</code>', text)

def svg_header(height):
    return f'<svg role="img" viewBox="0 0 880 {height}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#547c6b"/></marker></defs>'

def box(x,y,label,width=156):
    lines=label.split('|')
    text=''.join(f'<text x="{x+width/2}" y="{y+17+i*13}" text-anchor="middle" font-family="Arial" font-size="11" fill="#24473a">{html.escape(line)}</text>' for i,line in enumerate(lines))
    return f'<rect x="{x}" y="{y}" width="{width}" height="42" rx="7" fill="#edf5ef" stroke="#a9c6b8"/>'+text

def arrow(x1,y1,x2,y2):
    return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="#547c6b" stroke-width="1.4" fill="none" marker-end="url(#arrow)"/>'

def architecture():
    nodes={
        'client':(20,12,'Web and mobile|clients'), 'edge':(225,12,'Global edge|API / WAF / auth'),
        'gateway':(430,12,'Regional gateways|WebSocket fleet'), 'owner':(635,12,'Sharded owners|one leader per room'),
        'cdn':(20,100,'Multi-CDN|audio / artwork'), 'api':(225,100,'Catalogue / playlists|search API'),
        'cache':(430,100,'Redis snapshots|membership / TTL'), 'log':(635,100,'Replicated room log|fenced lease service'),
        'objects':(20,188,'Object storage|versioned renditions'), 'sql':(225,188,'PostgreSQL + search|users / metadata'),
        'events':(430,188,'Kafka event ingestion|QoE / royalties'), 'ledger':(635,188,'Royalty ledger|archive / warehouse'),
        'encode':(20,270,'Label ingest|transcode / rights'), 'outbox':(225,270,'Transactional outbox|index / cache updates'),
    }
    connections=[('client','edge'),('edge','gateway'),('gateway','owner'),('client','cdn'),('cdn','objects'),('objects','encode'),('edge','api'),('api','sql'),('sql','outbox'),('owner','log'),('gateway','cache'),('events','ledger')]
    result=svg_header(326)+'<title>High-level music streaming architecture</title>'
    for a,b in connections:
        ax,ay,_=nodes[a];bx,by,_=nodes[b]
        if ay==by:result+=arrow(ax+156,ay+21,bx,by+21)
        elif ax==bx:result+=arrow(ax+78,ay+42,bx+78,by)
    # Telemetry bypasses the room-control owner; encoding publishes catalogue metadata.
    result+='<path d="M98 54 L98 76 L508 76 L508 188" stroke="#547c6b" fill="none" stroke-dasharray="4 3" marker-end="url(#arrow)"/>'
    result+='<path d="M176 291 L198 291 L198 209 L225 209" stroke="#547c6b" fill="none" marker-end="url(#arrow)"/>'
    result+=''.join(box(*node) for node in nodes.values())
    return result+'</svg>'

def sequence():
    result=svg_header(354)+'<title>Host pause fan-out to 5,000 listeners</title>'
    xs=[65,212,359,506,653,800]
    names=['Host','Host gateway','Room owner','Durable log','Fan-out fleet','5,000 clients']
    for x,name in zip(xs,names):
        result+=box(x-62,4,name,124)
        result+=f'<path d="M{x} 46 L{x} 330" stroke="#b8c8bf" stroke-dasharray="4 4"/>'
    events=[(0,1,'Pause + request ID'),(1,2,'Authenticated command'),(2,3,'Append epoch / seq / effectiveAt'),(3,2,'Quorum commit'),(2,0,'Accepted + scheduled time'),(2,4,'One committed event / gateway'),(4,5,'Fan-out to sockets'),(5,5,'Schedule pause against clock'),(5,4,'Last sequence / QoE'),(5,2,'Gap or late: request snapshot'),(2,5,'Frozen position + version')]
    for i,(a,b,label) in enumerate(events):
        y=67+i*24
        if a==b:
            result+=f'<text x="{xs[a]}" y="{y}" text-anchor="middle" font-family="Arial" font-size="9.5" fill="#315d49">{label}</text>'
        else:
            result+=arrow(xs[a],y,xs[b],y)
            result+=f'<text x="{(xs[a]+xs[b])/2}" y="{y-5}" text-anchor="middle" font-family="Arial" font-size="9.5" fill="#24473a">{label}</text>'
    return result+'</svg>'

def render(markdown):
    parts=[]
    lines=markdown.strip().splitlines()
    i=0
    while i<len(lines):
        line=lines[i]
        if not line.strip():i+=1;continue
        if line.startswith('```mermaid'):
            diagram=[];i+=1
            while i<len(lines) and not lines[i].startswith('```'):
                diagram.append(lines[i]);i+=1
            parts.append('<figure>'+ (sequence() if 'sequenceDiagram' in diagram else architecture()) +'</figure>')
        elif line.startswith('#'):
            level=len(line)-len(line.lstrip('#'))
            parts.append(f'<h{level}>{inline(line[level:].strip())}</h{level}>')
        elif line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                row=[c.strip() for c in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r'[- :]+',c) for c in row):rows.append(row)
                i+=1
            parts.append('<table><thead><tr>'+''.join('<th>'+inline(c)+'</th>' for c in rows[0])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>' for row in rows[1:])+'</tbody></table>')
            continue
        else:
            paragraph=[line]
            while i+1<len(lines) and lines[i+1].strip() and not lines[i+1].startswith(('#','|','```')):
                i+=1;paragraph.append(lines[i])
            parts.append('<p>'+inline(' '.join(paragraph))+'</p>')
        i+=1
    return '\n'.join(parts)

pages=source.split('\n---\n')
assert len(pages)==6
style='''
@page {size:A4;margin:14mm 15mm}*{box-sizing:border-box}
body{font-family:Arial,sans-serif;color:#25382e;background:#e9eee9;margin:0;font-size:9pt;line-height:1.34}
.page{background:white;width:180mm;min-height:269mm;margin:20px auto;padding:8mm;position:relative;break-after:page}
.page:last-child{break-after:auto}h1{font-size:23pt;line-height:1.1;letter-spacing:-.5px;margin:0 0 8mm;color:#244f3c}
h2{font-size:17pt;line-height:1.16;margin:0 0 5mm;padding-bottom:3mm;border-bottom:2px solid #91b59d}
p{margin:0 0 3.4mm}strong{color:#244f3c}code{font-size:8pt;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin:4mm 0;font-size:8.2pt;line-height:1.28}
th,td{border:1px solid #d6e3d9;text-align:left;vertical-align:top;padding:2mm}th{background:#eaf1e8;color:#284b37}tr{break-inside:avoid}
figure{margin:3mm 0 4mm}svg{width:100%;display:block}a{color:#426d55}footer{margin-top:5mm;border-top:1px solid #c8d6c9;padding-top:2mm;color:#768777;font-size:8pt;display:flex;justify-content:space-between}
@media print{body{background:white}.page{width:auto;min-height:267mm;margin:0;padding:0}a{text-decoration:none}}
'''
document='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Listen Together - Architecture</title><style>'+style+'</style></head><body>'
for i,page in enumerate(pages,1):
    document+=f'<article class="page">{render(page)}<footer><span>LISTEN TOGETHER · DESIGN PROPOSAL</span><span>{i} / 6</span></footer></article>'
document+='</body></html>'
(ROOT/'docs/music-architecture.html').write_text(document,encoding='utf-8')
print('Generated six-section print HTML with two static SVG diagrams.')
