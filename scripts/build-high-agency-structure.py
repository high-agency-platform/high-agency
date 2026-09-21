"""Build the single-page High Agency structure diagram. Requires reportlab and fonttools[woff].
Run after a Next build to reuse the site's Gabarito font; otherwise uses Helvetica.
Optionally pass --font-dir with GuideText.ttf and GuideBold.ttf (Gabarito 400/800).
"""
import argparse
from pathlib import Path
from tempfile import TemporaryDirectory
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/resources/high-agency-structure.pdf'
W, H = 1200, 675
INK, MUTED, ORANGE = map(HexColor, ['#211C17', '#6E665B', '#FF5A1E'])
PAPER, LINE, SOFT = map(HexColor, ['#F5F2EB', '#E9E4D8', '#FFF0E9'])
parser = argparse.ArgumentParser()
parser.add_argument('--font-dir', type=Path)
args = parser.parse_args()
REG, BOLD = 'Helvetica', 'Helvetica-Bold'
# Reuse the web app's own font without adding duplicate font assets.
with TemporaryDirectory() as tmp:
    try:
        from fontTools.ttLib import TTFont as Font
        from fontTools.varLib.instancer import instantiateVariableFont
        for source in sorted((ROOT / '.next/static/media').glob('*.woff2')):
            font = Font(source)
            if not any('Gabarito' in n.toUnicode() for n in font['name'].names):
                continue
            if not font.getBestCmap().get(ord('A')):
                continue
            for weight, name in [(400, 'GuideText'), (800, 'GuideBold')]:
                f = Font(source)
                if 'fvar' in f:
                    f = instantiateVariableFont(f, {'wght': weight}, inplace=True)
                f.flavor = None
                path = Path(tmp) / f'{name}.ttf'
                f.save(path)
                pdfmetrics.registerFont(TTFont(name, str(path)))
            REG, BOLD = 'GuideText', 'GuideBold'
            break
    except (ImportError, OSError, ValueError):
        pass

    if args.font_dir:
        for name in ['GuideText', 'GuideBold']:
            pdfmetrics.registerFont(TTFont(name, str(args.font_dir / f'{name}.ttf')))
        REG, BOLD = 'GuideText', 'GuideBold'

    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=(W,H), pageCompression=1, invariant=1)
    c.setTitle('High Agency structure')
    c.setAuthor('High Agency')
    c.setSubject('The agency layer between ambition and opportunity')
    WHITE = HexColor('#FFFFFF')
    def text(t, x, y, size=11, bold=False, color=INK, center=False):
        c.setFillColor(color); c.setFont(BOLD if bold else REG,size)
        (c.drawCentredString if center else c.drawString)(x,y,t)
    def para(t,x,y,w,size=11,color=MUTED,leading=None,bold=False,center=False):
        p=Paragraph(t,ParagraphStyle('p',fontName=BOLD if bold else REG,fontSize=size,leading=leading or size*1.3,textColor=color,alignment=1 if center else 0))
        _,h=p.wrap(w,1000); p.drawOn(c,x,y-h); return h
    def box(x,y,w,h,fill=PAPER,stroke=None,r=12):
        c.setFillColor(fill); c.setStrokeColor(stroke or fill); c.roundRect(x,y,w,h,r,fill=1,stroke=bool(stroke))
    def dotlist(items,x,y,size=12,spacing=23):
        for i,item in enumerate(items):
            c.setFillColor(ORANGE);c.circle(x+2,y-i*spacing+4,2,fill=1,stroke=0)
            text(item,x+12,y-i*spacing,size)

    c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
    c.drawImage(ImageReader(str(ROOT/'public/brand/high-agency-mark-512.png')),27,623,30,30,mask='auto')
    text('HIGH AGENCY',66,633,13,True)
    c.setFont(REG,10);c.setFillColor(MUTED);c.drawRightString(1170,635,'THE PROGRAMME AT A GLANCE')
    text('High Agency structure',30,580,39,True)
    text('The agency layer between ambition and opportunity.',31,554,18,color=MUTED)

    box(30,378,1140,153,WHITE,LINE)
    box(30,495,1140,36,INK,r=10)
    text('NOT A CLASS. A LAUNCHPAD.',600,508,12,True,WHITE,center=True)
    pillars=[
      ('Build startups','Real products.<br/>Real users.'),
      ('Global community','Ultra-ambitious.<br/>Worldwide.'),
      ('Mentorship','Personalized,<br/>one-to-one.'),
      ('Operator workshops','Founders, leaders<br/>and operators.'),
      ('Tracks','The courses<br/>school skipped.'),
      ('Cohort boot camps','90-day sprints.<br/>Intense by design.'),
      ('Squads',"Five people who<br/>won't let you coast."),
      ('Personal AI stack','Agents and workflows<br/>you build, then run.'),
    ]
    for i,(title,body) in enumerate(pillars):
        x=30+i*142.5;mid=x+71.25
        if i:
            c.setStrokeColor(LINE);c.line(x,397,x,476)
        box(mid-13,457,26,24,SOFT,r=7)
        text(f'{i+1:02}',mid,465,10,True,ORANGE,True)
        text(title,mid,438,12,True,center=True)
        para(body,x+8,425,126.5,11.5,center=True)
    # A compact two-way link connects the experiences with the capabilities they build.
    c.setStrokeColor(ORANGE);c.setLineWidth(1.5);c.line(600,365,600,348)
    c.lines([(596,361,600,365),(604,361,600,365),(596,352,600,348),(604,352,600,348)])
    c.setLineWidth(1)

    box(30,63,170,272,SOFT,LINE)
    box(1000,63,170,272,SOFT,LINE)
    # Small line illustrations keep the side panels legible rather than decorative.
    c.setStrokeColor(ORANGE);c.setLineWidth(2)
    c.lines([(92,249,106,263),(106,263,117,252),(117,252,137,276),(126,276,137,276),(137,276,137,265)])
    para('PROGRESS<br/>UNLOCKS ACCESS',46,231,138,16,ORANGE,bold=True,center=True)
    para('Every rank you earn opens a real door: a person, a room, a role.',49,174,132,13,INK,leading=18,center=True)
    c.lines([(1065,249,1077,251),(1077,251,1101,275),(1101,275,1091,285),(1091,285,1067,261),(1067,261,1065,249),(1087,281,1097,271)])
    para('REAL WORK.<br/>REAL STAKES.',1016,231,138,16,ORANGE,bold=True,center=True)
    para('A track record, not a report card. Work a real operator will actually judge.',1019,174,132,13,INK,leading=18,center=True)
    c.setLineWidth(1)

    box(215,183,770,152,WHITE,LINE)
    text('HIGH AGENCY',235,311,15,True)
    text('SKILLS AND BEHAVIORS WE BUILD',378,312,10,color=ORANGE)
    c.setStrokeColor(LINE);c.line(235,297,965,297)
    skills=[
      ['Taking initiative','The cold ask','Negotiation','Handling conflict','Storytelling & influence'],
      ['How organizations work','How money moves','Judgment under uncertainty','Creating value with AI','Building things that ship'],
      ['Leading & executing','Managing yourself','Learning anything fast','Doing hard things'],
    ]
    for col,items in enumerate(skills):
        dotlist(items,236+col*250,279,12,19)

    box(215,63,770,106,WHITE,LINE)
    text('THE MENTOR NETWORK',235,145,15,True)
    text('REAL OPERATORS, NOT LECTURERS',440,146,10,color=ORANGE)
    c.setStrokeColor(LINE);c.line(235,134,965,134)
    mentors=[
      ['Startup founders','YC alumni','Fortune 500 leaders'],
      ['Startup operators','AI builders','Engineers'],
      ['Top investors','Big 4 consultants','GTM leaders'],
      ['Product leaders','Researchers','Alumni who made it'],
    ]
    for col,items in enumerate(mentors):
        dotlist(items,236+col*184,115,11.5,17)
    text('high-agency.io',30,32,10,color=MUTED)
    c.linkURL('https://high-agency.io',(30,28,104,43),relative=0)
    c.setFont(REG,9);c.setFillColor(MUTED);c.drawRightString(1170,32,'Programme vision  /  Ambition into action')
    c.save()
    print(f'Created {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes) using {REG}')
