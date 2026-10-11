#!/usr/bin/env python3
"""NAL free workbook Vol. 03, original editorial PDF typesetting."""
from pathlib import Path
import math,json,zipfile,shutil
from dataclasses import dataclass
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import fitz
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
DATA = json.loads((HERE/'series03_content.json').read_text(encoding='utf-8'))
COVER = OUT/'NAL_긍정문장따라쓰기_03_작은시작을믿는말_v1.1_스토어표지.png'
PDF_A5 = OUT/'NAL_긍정문장따라쓰기_03_작은시작을믿는말_v1.1_A5_컬러소책자.pdf'
PDF_A4 = OUT/'NAL_긍정문장따라쓰기_03_작은시작을믿는말_v1.1_A4_흑백인쇄.pdf'
PDF_FORM = OUT/'NAL_긍정문장따라쓰기_03_작은시작을믿는말_v1.1_디지털입력형.pdf'
BUNDLE = OUT/'NAL_긍정문장따라쓰기_03_작은시작을믿는말_v1.1_고객용패키지.zip'

F='/usr/share/fonts/truetype/nanum'
font_files={
  'NS':F+'/NanumBarunGothic.ttf',
  'NSB':F+'/NanumBarunGothicBold.ttf',
  'NM':F+'/NanumMyeongjo.ttf',
  'NMB':F+'/NanumMyeongjoBold.ttf',
}
for name,p in font_files.items(): pdfmetrics.registerFont(TTFont(name,p))

CW, CH = 419.528,595.276
INK='#292D29'; SECONDARY='#616760'; MOSS='#556B5A'; MUTED='#738373'; FAINT='#DADFD4'; PAPER='#F8F7F1'; WHITE='#FFFFFF'; TRACE='#ACB4A8'

# Text wrap tries to keep entire words and falls back to Hangul character breaking.
def width(text, font, size):
    return pdfmetrics.stringWidth(text,font,size)

def lines_for(text,font,size,maxw):
    if not text: return ['']
    out=[]
    for para in text.split('\n'):
        if not para: out.append(''); continue
        words=para.split(' '); cur=''
        for w in words:
            trial=(cur+' '+w).strip() if cur else w
            if width(trial,font,size)<=maxw:
                cur=trial;continue
            if cur: out.append(cur); cur=''
            if width(w,font,size)<=maxw: cur=w;continue
            part=''
            for char in w:
                if part and width(part+char,font,size)>maxw:
                    out.append(part);part=char
                else: part+=char
            cur=part
        if cur:out.append(cur)
    return out

@dataclass
class Variant:
  grayscale: bool=False
  digital: bool=False
  scale: float=1.0

class Book:
  def __init__(self,out,version):
    self.v=version; self.path=out
    W=595.276 if version.grayscale else CW
    H=841.89 if version.grayscale else CH
    self.c=canvas.Canvas(str(out),pagesize=(W,H),pageCompression=1)
    self.c.setTitle('긍정문장 따라 쓰기 03 — 작은 시작을 믿는 말')
    self.c.setAuthor('DAILYCOACHING · NAL')
    self.c.setSubject('NAL · 날빛 무료 마음도구 06 · 14일 긍정문장 따라 쓰기')
    self.c.setKeywords('날빛, NAL, 긍정문장, 따라쓰기, 시작, 실행, 기록, 무료 PDF')
    self.scale= W/CW
    self.count=0
    self.fields=[]
    self.palette = {
     'paper':'#FFFFFF' if version.grayscale else PAPER,
     'ink':'#222222' if version.grayscale else INK,
     'accent':'#525652' if version.grayscale else MOSS,
     'sub':'#646464' if version.grayscale else SECONDARY,
     'faint':'#C3C3C3' if version.grayscale else FAINT,
     'trace':'#A3A3A3' if version.grayscale else TRACE,
    }
  def color(self,key): return HexColor(self.palette.get(key,key))
  def fill(self,key):self.c.setFillColor(self.color(key))
  def stroke(self,key):self.c.setStrokeColor(self.color(key))
  def rect(self,x,y,w,h,fill,stroke=False):
    if fill:self.fill(fill)
    self.c.rect(x,y,w,h,fill=int(bool(fill)),stroke=int(stroke))
  def line(self,x1,y1,x2,y2,col='faint',stroke=0.65):
    self.stroke(col);self.c.setLineWidth(stroke);self.c.line(x1,y1,x2,y2)
  def text(self,t,x,y,font='NS',size=9.4,color='ink',align='left'):
    self.fill(color);self.c.setFont(font,size)
    if align=='right':self.c.drawRightString(x,y,str(t))
    elif align=='center':self.c.drawCentredString(x,y,str(t))
    else:self.c.drawString(x,y,str(t))
  def wrap(self,t,x,y,maxw,font='NS',size=9.2,leading=17,color='ink',gap=0):
    for line in lines_for(t,font,size,maxw):
      self.text(line,x,y,font,size,color);y-=leading
    return y-gap
  def begin(self,section,page_label=''):
    self.c.scale(self.scale,self.scale)
    self.count+=1
    self.rect(0,0,CW,CH,'paper')
    self.text('NAL · 날빛   /   FREE MIND TOOL 06',44,CH-32,'NS',7.1,'sub')
    self.text(section.upper(),CW-43,CH-32,'NS',7.1,'sub','right')
    self.line(44,CH-46,CW-43,CH-46,'faint',.65)
    self.line(44,42,CW-43,42,'faint',.65)
    self.text('NAL · 날빛  /  03',44,27,'NS',7.0,'sub')
    self.text(f'{self.count:02d}',CW-43,27,'NS',7.0,'sub','right')
  def done(self):self.c.showPage()
  def field(self,name,x,y,w,h,maxlen=220,multiline=False):
    if self.v.digital:self.fields.append((self.count,name,x,y,w,h,maxlen,multiline))
  def label(self,kicker,title,description=None):
    self.text(kicker,44,508,'NSB',8.0,'accent')
    self.text(title,44,463,'NMB',21.8,'ink')
    self.line(44,436,125,436,'accent',1.25)
    if description:self.wrap(description,44,409,330,'NS',9.0,18,'sub')
  def write_lines(self,y,howmany=2,x=44,w=331,step=24):
    for k in range(howmany):self.line(x,y-k*step,x+w,y-k*step,'faint',.73)

  def cover(self):
    self.c.scale(self.scale,self.scale)
    self.count+=1
    self.rect(0,0,CW,CH,'paper')
    if not self.v.grayscale:
      self.rect(0,CH-195,CW,195,'accent')
    header_ink='ink' if self.v.grayscale else '#FFFFFF'
    header_sub='sub' if self.v.grayscale else '#F0F2EB'
    self.text('NAL   /   날빛 작은 책 06',44,CH-38,'NSB',9.2,header_ink)
    self.line(44,CH-55,93,CH-55,header_ink,1.2)
    self.text('WORDS FOR THE NEXT STEP',44,CH-88,'NS',9.5,header_sub)
    self.text('조급함보다, 오늘 가능한 움직임을',44,CH-129,'NM',12.8,header_ink)
    self.text('긍정문장',43,338,'NMB',33,'ink')
    self.text('따라 쓰기',43,299,'NMB',33,'ink')
    self.text('03',CW-44,304,'NM',38,'accent','right')
    self.line(44,281,CW-43,281,'faint',.9)
    self.text('작은 시작을',44,243,'NMB',20.5,'ink')
    self.text('믿는 말',44,213,'NMB',20.5,'ink')
    self.wrap('해야 한다는 말보다 오늘 가능한 한 걸음을 찾는 14일',44,171,315,'NS',9.4,18,'accent')
    self.text('FREE WORKBOOK  /  14 DAYS  /  40 PAGES',44,59,'NSB',8.6,'accent')
    self.done()

  def intro(self):
    # 2 Opening
    self.begin('여는 말')
    self.label('OPENING LETTER','작은 시작을 믿는 말')
    y=390
    for p in [
      '누군가에게는 아무렇지 않은 일이 나에게는 오래 망설여지는 일이 있습니다. 메일을 보내는 일, 처음 한 줄을 적는 일, 오래 닫아둔 파일을 여는 일처럼요.',
      '그런 날에는 “할 수 있어”라는 말도 멀게 들립니다. 해야 한다는 말이 이미 충분하기 때문입니다. 이 책은 그 말 옆에 하나를 더 놓아보려 합니다.',
      '지금의 내가 할 수 있는 일은 무엇일까. 그리고 그것을 하지 않는 편이 더 나은 날이라면, 무엇을 지켜야 할까.',
      '14개의 장면과 문장을 따라가며 작은 움직임을 기록합니다. 빈칸이 남더라도 괜찮습니다. 이 책의 목적은 매일 성공했다는 표시를 모으는 것이 아닙니다.'
    ]:
      y=self.wrap(p,44,y,325,'NS',9.4,18.3,'ink',13)
    self.line(44,107,CW-44,107,'faint')
    self.text('내가 고를 수 있는 한 걸음은, 내가 살아 있는 자리에서 시작됩니다.',44,86,'NM',10.5,'accent')
    self.done()
    # 3 prologue
    self.begin('프롤로그')
    self.label('PROLOGUE','문 앞에서 신발 끈을 묶는 동안')
    y=393
    for p in [
      '현관에 신발을 꺼내놓고도 쉽게 문을 열지 못하는 아침이 있습니다. 나가면 해야 할 일들이 기다리는 것을 알기 때문입니다.',
      '나는 아직 준비가 되지 않았다는 이유를 찾습니다. 날씨를 확인하고, 가방을 다시 뒤집어보고, 어제 놓친 일을 떠올립니다. 그러는 사이 잠깐의 두려움은 하루 전체의 크기로 자랍니다.',
      '그날 나를 움직이게 한 것은 대단한 결심이 아니었습니다. 신발 끈을 묶는 일이었습니다. 그다음에는 문고리를 잡는 일. 그리고 복도까지 나가는 일이었습니다.',
      '이 책을 읽는 당신에게도 그런 순서가 있을 것입니다. 시작을 강요하지 않고, 지금의 조건에서 가능한 순서를 찾아봅니다.'
    ]: y=self.wrap(p,44,y,324,'NS',9.5,19,'ink',13)
    self.text('어떤 날은 한 걸음보다 쉼이 먼저 필요합니다.',44,95,'NM',11,'accent')
    self.done()
    # 4 how to
    self.begin('사용 안내')
    self.label('HOW TO','한 문장을 쓰는 네 가지 방법')
    methods=[
      ('01','읽기','먼저 그날의 장면을 읽고 내 삶의 어느 순간이 떠오르는지 살펴봅니다.'),
      ('02','따라 쓰기','연하게 인쇄된 문장을 천천히 따라 씁니다. 마음에 닿지 않는 표현은 고쳐도 좋습니다.'),
      ('03','내 말로 바꾸기','누구에게나 좋은 말보다 오늘 나에게 실제로 필요한 말을 한 줄 남깁니다.'),
      ('04','작은 선택','성공을 증명할 행동 대신 지금의 시간·힘·상황에 맞는 시도 하나를 골라봅니다.')
    ]
    for i,(no,heading,detail) in enumerate(methods):
      y=395-i*72
      self.text(no,44,y+1,'NM',19,'accent');self.text(heading,87,y+1,'NSB',11,'ink')
      desc_y=self.wrap(detail,87,y-23,280,'NS',9.15,15.5,'sub')
      assert desc_y > y-62, f'How-to method {no} has too many lines'
      self.line(44,y-61,CW-43,y-61,'faint')
    self.wrap('이 책은 자기성찰을 위한 도구이며, 어떤 결과나 정서적 변화를 약속하지 않습니다. 오늘 쓰기 어렵다면 건너뛰거나 쉬어도 됩니다.',44,94,326,'NS',8.3,15.3,'sub')
    self.done()
    # 5 check in
    self.begin('쓰기 전')
    self.label('CHECK-IN','지금 나의 시작 앞에는')
    self.text('정답을 찾기보다 지금 있는 자리를 간단하게 적어봅니다.',44,407,'NS',9.2,'sub')
    prompts=[
      '01  자꾸 뒤로 미루고 있는 일 한 가지는?',
      '02  그 일을 떠올릴 때 내 몸과 마음은 어떠한가요?',
      '03  지금 내가 실제로 가진 시간과 힘은 어느 정도인가요?',
    ]
    y=362
    for j,prompt in enumerate(prompts):
      self.text(prompt,44,y,'NSB',9.3,'ink');self.write_lines(y-28,2,step=21)
      self.field(f'checkin_{j+1}',45,y-69,329,42,200,True)
      y-=106
    self.text('오늘의 상태를 정확히 아는 일이 시작의 한 부분입니다.',44,65,'NM',9.6,'accent')
    self.done()
    # 6 contents
    self.begin('14일의 문장')
    self.label('CONTENTS','14일의 작은 시작들')
    self.text('순서대로 쓰지 않아도 좋습니다. 오늘의 장면과 닿는 날을 펼쳐보세요.',44,409,'NS',8.7,'sub')
    for index,d in enumerate(DATA['days']):
      col=0 if index<7 else 1
      row=index if index<7 else index-7
      x=44 if col==0 else 219
      yy=366-row*40
      self.text(f'{d["day"]:02d}',x,yy,'NM',13.2,'accent')
      # may need truncate topic display
      self.text(d['topic'],x+32,yy+1,'NS',8.3,'ink')
      self.text(f'{7+(d["day"]-1)*2:02d}',x+154,yy+1,'NS',7.7,'sub','right')
      self.line(x,yy-14,x+155,yy-14,'faint',.55)
    self.text('7쪽부터 매일 읽는 페이지와 따라 쓰기 페이지가 이어집니다.',44,65,'NS',8.5,'sub')
    self.done()

  def story(self,d):
    no=d['day']
    self.begin(f'DAY {no:02d} / 읽는 시간')
    self.text(f'DAY {no:02d}   /   살펴보기   /   {d["chapter"]}',44,499,'NSB',8.2,'accent')
    # Variable title width/size
    fontsize=20.5
    while width(d['title'],'NMB',fontsize)>334 and fontsize>15:
      fontsize-=.5
    self.text(d['title'],44,452,'NMB',fontsize,'ink')
    self.line(44,425,125,425,'accent',1.15)
    y=400
    fs=9.0
    for p in d['paras']:
      y=self.wrap(p,44,y,330,'NS',fs,15.8,'ink',8.0)
    if y < 221:
       # fail rather than overwrite lower memo if long
       raise RuntimeError(f'Story overflows on day {no}: body ends at {y:.1f}')
    self.text('한 줄 장면 메모',44,207,'NSB',8.3,'accent')
    self.text(d['memo'],44,188,'NS',8.2,'sub')
    self.write_lines(165,2,step=20)
    self.field(f'day{no:02d}_scene',44,126,329,46,160,True)
    self.text('작은 시도  /  오늘 가능하다면',44,108,'NSB',7.9,'accent')
    self.wrap(d['action'],44,90,330,'NS',8.1,15,'sub')
    self.done()

  def practice(self,d):
    no=d['day'];self.begin(f'DAY {no:02d} / 따라 쓰기')
    self.text(f'DAY {no:02d}   /   오늘의 문장   /   {d["topic"]}',44,505,'NSB',8.2,'accent')
    fontsize=17.2
    sentence_lines=lines_for(d['sentence'],'NMB',fontsize,331)
    while len(sentence_lines)>2 and fontsize>14.4:
      fontsize-=.5;sentence_lines=lines_for(d['sentence'],'NMB',fontsize,331)
    top=461
    for i,line in enumerate(sentence_lines):self.text(line,44,top-i*25,'NMB',fontsize,'ink')
    self.line(44,396,375,396,'faint',.7)
    self.text('01   천천히 따라 쓰기',44,373,'NSB',8.7,'accent')
    # high enough contrast that user can actually trace letters with pen.
    for n,yy in enumerate((344,318)):
      trace_size=10.25
      wrapped=lines_for(d['sentence'],'NS',trace_size,325)
      if len(wrapped)==1:
        self.text(wrapped[0],44,yy,'NS',trace_size,'trace')
      else:
        # For long statement, use fitting font so always single trace line.
        sz=trace_size
        while width(d['sentence'],'NS',sz)>327 and sz>7.2:sz-=.2
        self.text(d['sentence'],44,yy,'NS',sz,'trace')
      self.line(44,yy-5,375,yy-5,'faint',.68)
    self.text('02   문장을 보지 않고 다시 쓰기',44,281,'NSB',8.7,'accent')
    self.write_lines(253,2,step=22)
    self.field(f'day{no:02d}_copy',44,224,329,46,175,True)
    self.text('03   내 말로 바꾸기',44,202,'NSB',8.7,'accent')
    self.text(d['question'],44,182,'NS',8.4,'sub')
    self.write_lines(157,2,step=21)
    self.field(f'day{no:02d}_own',44,116,329,49,200,True)
    self.text('04   오늘 가능한 작은 선택',44,105,'NSB',8.7,'accent')
    self.line(44,77,375,77,'faint')
    self.field(f'day{no:02d}_step',44,73,329,24,135,False)
    self.done()

  def ending(self):
    # 35 - review
    self.begin('14일 돌아보기')
    self.label('REVIEW','다시 읽고 싶은 하루')
    self.wrap('모든 날을 채우지 않아도 괜찮습니다. 쓰면서 무엇이 쉬웠고, 무엇이 어려웠는지 내 말로 돌아봅니다.',44,410,331,'NS',9.3,17,'sub')
    prompts=[
       '01   다시 펼치고 싶은 하루와 그 이유',
       '02   지금 내게 가장 자연스러운 문장',
       '03   아직 어렵게 느껴지는 말과 그 까닭'
    ]
    y=354
    for i,p in enumerate(prompts):
      self.text(p,44,y,'NSB',9,'ink')
      self.write_lines(y-31,2,step=23)
      self.field(f'review_{i+1}',44,y-76,328,48,200,True)
      y-=101
    self.text('오늘의 말이 내일의 명령이 될 필요는 없습니다.',44,61,'NM',9.7,'accent')
    self.done()
    # 36 - my sentence
    self.begin('마지막 쓰기')
    self.label('MY SENTENCE','내가 계속 건네고 싶은 한 문장')
    y=self.wrap('남의 마음을 움직이는 말이나 대단해 보이는 결심보다, 지금 내 삶에 실제로 도움이 되는 말을 적어봅니다. 쓰다가 바꾸어도 좋습니다.',44,402,330,'NS',9.2,18,'sub')
    self.text('01   내 말로 남길 문장',44,335,'NSB',9,'accent')
    self.write_lines(299,3,step=30)
    self.field('final_sentence',44,218,330,90,250,True)
    self.text('02   이 말을 필요로 하는 실제 장면',44,193,'NSB',9,'accent')
    self.write_lines(160,3,step=25)
    self.field('final_scene',44,99,330,66,200,True)
    self.done()
    # 37 - 7d micro experiment
    self.begin('7일의 작은 실험')
    self.label('NEXT 7 DAYS','다음 일주일, 내 방식으로')
    self.text('해야 하는 횟수 대신, 해보고 싶은 방식 하나를 정합니다.',44,410,'NS',8.9,'sub')
    self.text('내가 반복해보고 싶은 작은 행동',44,379,'NSB',9,'ink')
    self.line(44,351,375,351,'faint')
    self.field('experiment_action',44,346,331,26,150,False)
    self.text('7일 동안 하루 한 칸씩 기록해보세요. 쉬어간 날은 비워두어도 좋습니다.',44,323,'NS',8.0,'sub')
    y=299
    for i in range(7):
      self.text(f'{i+1:02d}',46,y+2,'NM',10,'accent')
      self.line(80,y,375,y,'faint')
      self.field(f'experiment_day_{i+1}',81,y-5,290,22,130,False)
      y-=30
    self.text('마지막 날, 계속할지 바꿀지 결정하는 기준은?',44,88,'NSB',8.6,'accent')
    self.line(44,64,375,64,'faint')
    self.field('experiment_decision',44,60,329,23,150,False)
    self.done()
    # 38 blank
    self.begin('여백')
    self.label('BLANK PAGE','아직 쓰지 않은 다음 이야기')
    self.wrap('이곳에는 내가 고른 행동을 적어도 좋고, 아무 말 없이 비워두어도 좋습니다. 여백도 책의 일부입니다.',44,402,330,'NS',9.4,18,'sub')
    for y in range(335,83,-29):self.line(44,y,375,y,'faint')
    self.field('blank_notes',44,79,331,270,650,True)
    self.done()
    # 39 epilogue
    self.begin('에필로그')
    self.label('EPILOGUE','끝까지 하지 않은 일들도')
    y=396
    for p in [
     '어떤 문장은 곧바로 적혔고, 어떤 문장은 여러 번 고쳐 쓰게 되었을 것입니다. 미처 펼치지 않은 페이지도 있을 수 있습니다.',
     '책을 끝냈다고 내일 갑자기 부지런한 사람이 되는 것은 아닙니다. 다만 자신을 몰아붙이는 말 대신 조금 더 정확한 말을 고르는 연습은 남을 수 있습니다.',
     '무언가를 시작하지 못했다면 그 이유를 궁금해해도 됩니다. 필요한 도움은 무엇인지, 무엇을 줄여야 하는지, 언제 쉬어야 하는지 묻는 것도 다음 한 걸음입니다.',
     '그래서 마지막에 남길 말은 거창하지 않습니다. 내가 다음에 다시 선택할 수 있도록, 오늘을 있는 그대로 기억해봅니다.'
    ]:y=self.wrap(p,44,y,327,'NS',9.5,19,'ink',12)
    self.line(44,112,CW-44,112,'faint')
    self.text('오늘만큼의 내가 선택한 것을 기억합니다.',44,85,'NM',11,'accent')
    self.done()
    # 40 back matter
    self.begin('NAL MIND TOOLS')
    self.text('NAL MIND TOOLS    /    VOL. 03',44,498,'NSB',9.3,'accent')
    self.text('크게 바꾸지 않아도,',44,430,'NMB',22,'ink')
    self.text('다시 살펴볼 수 있도록.',44,390,'NMB',22,'ink')
    self.line(44,357,375,357,'faint')
    for j,t in enumerate([
      '01   긍정문장 따라 쓰기  /  내게 건네는 14개의 문장',
      '02   관계 속에서도 나를 잃지 않는 말  /  관계',
      '03   작은 시작을 믿는 말  /  선택과 실행',
    ]):self.text(t,44,316-j*29,'NS',8.1 if j==0 else 8.55,'ink' if j==2 else 'sub')
    self.wrap('날빛은 읽고 지나가는 문장보다 일상의 장면에 가져가 다시 쓸 수 있는 문장을 만듭니다.',44,199,322,'NS',9.2,19,'sub')
    self.wrap('무료 개인용 워크북입니다. 개인 열람·인쇄는 가능하지만 파일의 재판매·재업로드·무단 재배포는 허용하지 않습니다. 전문적인 진단이나 치료를 대신하지 않습니다.',44,119,328,'NS',7.8,14,'sub')
    self.text('긍정문장 시리즈 03  ·  무료 마음도구 전체 06',44,60,'NS',7.3,'sub')
    self.done()

  def build(self):
    self.cover();self.intro()
    for d in DATA['days']:self.story(d);self.practice(d)
    self.ending()
    assert self.count==40, self.count
    self.c.save()
    if self.v.digital:self.attach_widgets()
    with fitz.open(self.path) as doc:
      assert doc.page_count==40,(self.path,doc.page_count)
      for page in doc:
        assert not page.get_text().count('\u25a0'), 'PDF missing-glyph square check'
    print('BUILT',self.path.name,self.path.stat().st_size,'bytes',len(self.fields),'fields')

  def attach_widgets(self):
    """Add editable fields with an embedded Hangul-capable Unicode font.

    Adobe Acrobat / mobile input rendering may still vary, but the embedded
    Identity-H font and AcroForm DR resource avoid the Latin Helvetica fallback
    that previously distorted Korean input. No separate font file is shipped.
    """
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject, DictionaryObject, TextStringObject, BooleanObject
    raw=self.path.with_name(self.path.stem+'-raw.pdf')
    fonted=self.path.with_name(self.path.stem+'-font.pdf')
    formdone=self.path.with_name(self.path.stem+'-final.pdf')

    doc=fitz.open(self.path)
    for page_no,name,x,y,w,h,maxlen,multiline in self.fields:
      page=doc[page_no-1]
      sw=self.scale
      R=fitz.Rect(x*sw,(CH-(y+h))*sw,(x+w)*sw,(CH-y)*sw)
      wd=fitz.Widget()
      wd.field_name=name
      wd.field_label=name
      wd.field_type=fitz.PDF_WIDGET_TYPE_TEXT
      wd.rect=R
      wd.text_font='Helv'  # provisional; replaced below by /Ko for all fields
      wd.text_fontsize=9*sw
      wd.text_color=(0.16,0.20,0.17)
      wd.border_width=0
      wd.fill_color=None
      wd.field_value=''
      wd.text_maxlen=maxlen
      wd.field_flags=fitz.PDF_TX_FIELD_IS_MULTILINE if multiline else 0
      page.add_widget(wd)
    doc.set_metadata({
      'title':'NAL 긍정문장 따라 쓰기 03 - 작은 시작을 믿는 말 (v1.1)',
      'author':'DAILYCOACHING · NAL',
      'subject':'NAL 무료 마음도구 06 · 14일 따라 쓰기 · 디지털 입력형',
      'keywords':'NAL, 날빛, 긍정문장, 따라쓰기, 작은 시작, 무료 워크북',
      'creator':'NAL Mind Tools Editorial',
      'producer':'ReportLab + PyMuPDF',
    })
    doc.save(raw,garbage=4,deflate=True)
    doc.close()

    d=fitz.open(raw)
    d[0].insert_font(fontname='Ko',fontfile=font_files['NS'],set_simple=False)
    d.save(fonted,garbage=4,deflate=True)
    d.close()

    reader=PdfReader(fonted)
    writer=PdfWriter()
    writer.append(reader)
    font_ref=writer.pages[0]['/Resources']['/Font']['/Ko']
    acro=writer._root_object['/AcroForm'].get_object()
    acro[NameObject('/DR')]=DictionaryObject({
      NameObject('/Font'):DictionaryObject({NameObject('/Ko'):font_ref})
    })
    acro[NameObject('/DA')]=TextStringObject('0.16 0.20 0.17 rg /Ko 9 Tf')
    acro[NameObject('/NeedAppearances')]=BooleanObject(False)
    friendly={
      'scene':'읽기 장면 메모','copy':'다시 쓰기','own':'내 말로 바꾸기',
      'step':'오늘의 작은 선택',
    }
    count=0
    for page in writer.pages:
      for ref in page.get('/Annots',[]):
        annotation=ref.get_object()
        if annotation.get('/Subtype')!='/Widget': continue
        name=str(annotation.get('/T',''))
        annotation[NameObject('/DA')]=TextStringObject('0.16 0.20 0.17 rg /Ko 9 Tf')
        if name.startswith('day'):
          part=name[3:5]
          suffix=name.split('_',1)[-1]
          label=f'{part}일차 · {friendly.get(suffix,suffix)}'
        else:
          label=name.replace('_',' ')
        annotation[NameObject('/TU')]=TextStringObject(label)
        count+=1
    assert count==len(self.fields), (count,len(self.fields))
    writer.add_metadata({
      '/Title':'NAL 긍정문장 따라 쓰기 03 - 작은 시작을 믿는 말 (v1.1)',
      '/Author':'DAILYCOACHING · NAL',
      '/Subject':'날빛 무료 마음도구 06 · 14일 따라 쓰기 · 디지털 입력형',
      '/Keywords':'날빛, 긍정문장, 따라쓰기, 작은 시작, 무료 PDF',
      '/Creator':'NAL Mind Tools Editorial',
    })
    with open(formdone,'wb') as f:
      writer.write(f)
    formdone.replace(self.path)
    raw.unlink(missing_ok=True)
    fonted.unlink(missing_ok=True)
    print('EMBEDDED Korean font for',count,'form fields')


def store_cover():
  W,H=1200,1600
  img=Image.new('RGB',(W,H),PAPER);d=ImageDraw.Draw(img)
  d.rectangle((0,0,W,490),fill='#4C6053')
  def pf(size,bold=False,serif=False):
    p = font_files['NMB' if bold and serif else 'NM' if serif else 'NSB' if bold else 'NS']
    return ImageFont.truetype(p,size)
  def tx(x,y,text,size,color,serif=False,bold=False,anchor=None):
    d.text((x,y),text,font=pf(size,bold,serif),fill=color,anchor=anchor,stroke_width=0)
  tx(108,103,'NAL   /   날빛 작은 책 06',35,'#F6F8F2',bold=True)
  d.line((108,175,251,175),fill='#F4F6F0',width=4)
  tx(108,235,'WORDS FOR THE NEXT STEP',30,'#DDE6DA')
  tx(108,335,'조급함보다, 오늘 가능한 움직임을',39,'#F6F8F2',serif=True)
  tx(108,598,'긍정문장',104,'#292D29',serif=True,bold=True)
  tx(108,724,'따라 쓰기',104,'#292D29',serif=True,bold=True)
  tx(1091,756,'03',90,'#647867',serif=True,anchor='ra')
  d.line((108,859,1092,859),fill='#CCD5C9',width=3)
  tx(108,929,'작은 시작을',74,'#292D29',serif=True,bold=True)
  tx(108,1042,'믿는 말',74,'#292D29',serif=True,bold=True)
  tx(108,1206,'해야 한다는 말보다',37,'#647867')
  tx(108,1260,'오늘 가능한 한 걸음을 찾는 14일',37,'#647867')
  tx(108,1500,'FREE WORKBOOK   /   14 DAYS   /   40 PAGES',28,'#4C6053',bold=True)
  img.save(COVER,optimize=True)
  return img


def run():
  store_cover()
  Book(PDF_A5,Variant()).build()
  Book(PDF_A4,Variant(grayscale=True)).build()
  Book(PDF_FORM,Variant(digital=True)).build()

  details={
    'schemaVersion':'2.0','releaseStatus':'asset-ready / unpublished',
    'proposedAssetPaths':{
      'A5':'/nal/assets/downloads/free/nal-positive-writing-03-small-starts-v11-a5.pdf',
      'A4':'/nal/assets/downloads/free/nal-positive-writing-03-small-starts-v11-a4-print.pdf',
      'fill':'/nal/assets/downloads/free/nal-positive-writing-03-small-starts-v11-fillable.pdf',
      'cover':'/nal/assets/images/catalog/shop/positive-writing/nal-positive-writing-03-cover-v11.png'
    },
    'product':{
      'id':'nal-positive-writing-03-small-starts','slug':'nal-positive-writing-03-small-starts',
      'title':'작은 시작을 믿는 말','subtitle':DATA['subtitle'],
      'author':DATA['author'],
      'summary':'망설임, 첫 시도, 어긋난 계획, 휴식, 도움 요청을 다루는 14일 긍정문장 따라 쓰기 워크북.',
      'description':'거창한 다짐 대신 지금 가능한 움직임을 살피는 NAL 긍정문장 따라 쓰기 세 번째 권. 짧은 일상 에세이와 14개 문장, 필사, 내 말로 바꾸기, 작은 선택, 7일 실험을 담았습니다.',
      'category':'날빛 작은 책 · 무료','tags':['날빛','긍정문장','따라쓰기','선택','작은 실천','자기이해','무료 워크북'],
      'coverImage':'/nal/assets/images/catalog/shop/positive-writing/nal-positive-writing-03-cover-v11.png',
      'coverImageAlt':'올리브그린과 아이보리 타이포그래피의 NAL 긍정문장 따라 쓰기 03 작은 시작을 믿는 말 표지',
      'gallery':[],'galleryAlts':[],
      'price':0,'originalPrice':None,'productType':'pdfWorkbook','deliveryType':'digital',
      'stock':None,'stockStatus':'comingSoon','options':[],
      'components':['A5 컬러 소책자 PDF · 40쪽','A4 흑백 인쇄판 PDF · 40쪽','디지털 한글 입력형 PDF · 40쪽','14일 실천과 7일 실험'],
      'cardCount':None,'pageCount':40,
      'recommendedFor':['시작이 늦어져 스스로를 재촉할 때','준비가 부족하다는 생각에 머뭇거릴 때','쉬거나 계획을 바꿔야 하는 날'],
      'usageIndividual':'하루 한 장면을 읽고 문장을 따라 씁니다. 오늘의 상황에 맞게 자신의 말로 고친 뒤 작은 선택 하나를 기록합니다. 순서대로 완주할 필요는 없습니다.',
      'usageCouple':None,'usageGroup':None,
      'precautions':'자기성찰용 자료입니다. 심리 진단·치료를 대신하지 않습니다. 개인 열람·인쇄 가능, 무단 재판매·재업로드·재배포 금지.',
      'visualNote':'올리브그린·웜아이보리 타이포그래피 표지와 넓은 필기 공간.',
      'shippingPolicy':None,'exchangePolicy':None,
      'refundPolicy':'0원 무료 제공 콘텐츠로 결제·환불 대상이 아닙니다.',
      'purchaseUrl':None,'sampleUrl':None,'previewUrl':None,'sourceUrl':None,
      'relatedProgramIds':[],'relatedContentIds':[],'featured':False,'featuredOrder':None,'published':False,
      'createdAt':'2026-10-11','updatedAt':'2026-10-12',
      'fileFormat':'PDF','fileSizeMB':round(PDF_A5.stat().st_size/(1024*1024),2),
      'deliveryMethod':'digital-download','licenseType':'personal-use','printingAllowed':True,
      'downloadLimit':None,'accessPeriod':'제한 없음',
      'fulfillmentNote':'스토어 공개 전 최종 배포 파일입니다. 공개 시 로그인·결제 없이 PDF 3종을 직접 내려받을 수 있게 연결합니다.',
      'audiences':['개인'],'topics':['자기이해','글쓰기','코칭'],
      'tableOfContents':['여는 말','프롤로그','사용 안내','시작 전 체크인']
           + [f"{d['day']:02d} {d['topic']}" for d in DATA['days']]
           + ['14일 돌아보기','나의 문장','다음 7일 실험','에필로그'],
      'licenseOptions':[],'version':'1.1-free-final','policyStatus':'reviewed','policyVersion':None,
    }
  }
  product=HERE/'NAL_03_스토어상품정보_v1.1.json'
  product.write_text(json.dumps(details,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  notes=HERE/'읽어주세요_고객용.txt'
  notes.write_text('''NAL · 날빛 | 긍정문장 따라 쓰기 03
작은 시작을 믿는 말 (v1.1)

14일 · 14개 문장 · 총 40쪽 · 0원

어떤 파일을 열까요?
1. A5 컬러 소책자: 휴대폰·태블릿에서 읽기, 컬러 인쇄
2. A4 흑백 인쇄판: 집에서 프린터로 인쇄 후 직접 필기
3. 디지털 입력형: PDF 양식 편집을 지원하는 앱에서 텍스트 입력·저장

작성 방법: 짧은 이야기를 읽고 문장을 천천히 따라 쓴 뒤, 나에게 필요한 말과 오늘 가능한 작은 선택을 적습니다. 14일을 연속으로 채울 필요는 없습니다.

디지털 입력형에는 한글 표시를 돕는 글꼴이 포함되어 있습니다. PDF 앱마다 양식 입력·저장 지원이 달라질 수 있습니다. 입력한 내용은 앱에서 저장 후 다시 열어 확인하세요.

개인 열람·인쇄를 위한 무료 자료입니다. 파일 자체의 재판매·재업로드·무단 재배포는 허용되지 않습니다. 전문적인 심리 진단·치료를 대신하지 않습니다.

제작: DAILYCOACHING · NAL · 날빛   /   2026.10
''',encoding='utf-8')
  internal=HERE/'README_운영자용_v1.1.md'
  internal.write_text('''# NAL 긍정문장 따라 쓰기 03 · 최종 교정 v1.1

- 출시 상태: 상품 DB/사이트 미등록. 본 패키지는 상품 등록용 자산이다.
- 고객에게는 고객용 ZIP만 배포한다. 제작 소스와 스토어 JSON은 제외.
- 권장: A5(읽기), A4(인쇄), 디지털 입력(기기별 호환 확인).
- v1.1 교정: 3·10·11·14일차 문장, 37쪽 일주일 실험, 40쪽 시리즈 실제 상품명, 폼 한글 표시 글꼴 및 메타데이터.
- PDF 세 종류 모두 40쪽. 폼 기록 필드는 74개.
- 디지털판: embedded Type0 / Identity-H 한글 폰트; 빈 AcroForm 텍스트 필드의 표시 및 호환은 각 PDF 뷰어에 따라 다르다.
- 본 자산의 대외 웹 주소는 미배포 상태다. 배포 성공 검증 전 공개 링크로 안내하지 말 것.
- 글꼴 원본 파일은 이 패키지에 포함하지 않는다. PDF 내부에 사용 권한이 있는 글꼴 데이터만 포함되어 있다.

## 파일

- series03_content.json: 14일 원고 기준본
- build_series03_v11.py: PDF 편집·생성 코드 (Nanum글꼴 설치 필요)
- NAL_03_스토어상품정보_v1.1.json: 공개 전 상품 정보
- 표지 PNG: 스토어용
- 고객용 zip: PDF 3종과 읽어주세요
''',encoding='utf-8')
  # Customer ZIP: only PDFs and usage note, never the source or catalog JSON.
  with zipfile.ZipFile(BUNDLE,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as z:
    for p in [PDF_A5,PDF_A4,PDF_FORM,notes]: z.write(p,p.name)
  internal_zip=OUT/'NAL_긍정문장따라쓰기_03_작은시작을믿는말_v1.1_운영자용제작패키지.zip'
  with zipfile.ZipFile(internal_zip,'w',zipfile.ZIP_DEFLATED,compresslevel=8) as z:
    for p in [PDF_A5,PDF_A4,PDF_FORM,COVER,product,notes,HERE/'series03_content.json',internal,Path(__file__)]:
      z.write(p,('build_series03_v11.py' if p==Path(__file__) else p.name))
  print('BUNDLE',BUNDLE,BUNDLE.stat().st_size)
  print('INTERNAL',internal_zip,internal_zip.stat().st_size)

if __name__=='__main__':run()