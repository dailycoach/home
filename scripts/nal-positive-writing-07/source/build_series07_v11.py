#!/usr/bin/env python3
"""NAL · 날빛 긍정문장 따라 쓰기 07 v1.1; 14-day editorial workbook about mistakes, responsibility, and self-respect."""
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
DATA = json.loads((HERE/'series07_content_v11.json').read_text(encoding='utf-8'))
COVER = OUT/'NAL_긍정문장따라쓰기_07_실수한날에도나를존중하는말_v1.1_스토어표지.png'
PDF_A5 = OUT/'NAL_긍정문장따라쓰기_07_실수한날에도나를존중하는말_v1.1_A5_컬러소책자.pdf'
PDF_A4 = OUT/'NAL_긍정문장따라쓰기_07_실수한날에도나를존중하는말_v1.1_A4_흑백인쇄.pdf'
PDF_FORM = OUT/'NAL_긍정문장따라쓰기_07_실수한날에도나를존중하는말_v1.1_디지털입력형.pdf'
BUNDLE = OUT/'NAL_긍정문장따라쓰기_07_실수한날에도나를존중하는말_v1.1_고객용패키지.zip'

F='/usr/share/fonts/truetype/nanum'
font_files={
  'NS':F+'/NanumBarunGothic.ttf',
  'NSB':F+'/NanumBarunGothicBold.ttf',
  'NM':F+'/NanumMyeongjo.ttf',
  'NMB':F+'/NanumMyeongjoBold.ttf',
}
for name,p in font_files.items(): pdfmetrics.registerFont(TTFont(name,p))

CW, CH = 419.528,595.276
INK='#3D3433'; SECONDARY='#697672'; MOSS='#95665C'; MUTED='#76827D'; FAINT='#E7DCD5'; PAPER='#FBF8F4'; WHITE='#FFFFFF'; TRACE='#C3B1A9'

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
    self.c.setTitle('긍정문장 따라 쓰기 07 — 실수한 날에도 나를 존중하는 말 · v1.1')
    self.c.setAuthor('DAILYCOACHING · NAL')
    self.c.setSubject('NAL · 날빛 긍정문장 시리즈 07 / 무료 마음도구 10 · 14일 따라 쓰기')
    self.c.setKeywords('날빛, NAL, 긍정문장, 따라쓰기, 실수, 후회, 책임, 자기존중, 기록, 무료 PDF')
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
    self.text('NAL · 날빛   /   긍정문장 시리즈 07',44,CH-32,'NS',7.1,'sub')
    self.text(section.upper(),CW-43,CH-32,'NS',7.1,'sub','right')
    self.line(44,CH-46,CW-43,CH-46,'faint',.65)
    self.line(44,42,CW-43,42,'faint',.65)
    self.text('무료 마음도구 10   /   시리즈 07',44,27,'NS',7.0,'sub')
    self.text(f'{self.count:02d}',CW-43,27,'NS',7.0,'sub','right')
  def done(self):self.c.showPage()
  def field(self,name,x,y,w,h,maxlen=220,multiline=False):
    if self.v.digital:self.fields.append((self.count,name,x,y,w,h,maxlen,multiline))
  def label(self,kicker,title,description=None):
    self.text(kicker,44,508,'NSB',8.0,'accent')
    size=21.8
    while width(title,'NMB',size)>330 and size>14:size-=.4
    self.text(title,44,463,'NMB',size,'ink')
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
    header_sub='sub' if self.v.grayscale else '#EAF2EE'
    self.text('NAL   /   긍정문장 시리즈 07',44,CH-38,'NSB',9.2,header_ink)
    self.line(44,CH-55,93,CH-55,header_ink,1.2)
    self.text('MISTAKES, REPAIR, RESPECT',44,CH-88,'NS',9.4,header_sub)
    self.text('잘못한 일을 고치되 나를 함부로 부르지 않는 시간',44,CH-129,'NM',11.5,header_ink)
    self.text('긍정문장',43,338,'NMB',33,'ink')
    self.text('따라 쓰기',43,299,'NMB',33,'ink')
    self.text('07',CW-44,304,'NM',38,'accent','right')
    self.line(44,281,CW-43,281,'faint',.9)
    self.text('실수한 날에도',44,243,'NMB',19.0,'ink')
    self.text('나를 존중하는 말',44,213,'NMB',20.5,'ink')
    self.wrap('실수와 후회를 지나, 책임과 자기존중을 함께 살피는 14일',44,171,322,'NS',9.0,17,'accent')
    self.text('FREE MIND TOOL 10   /   14 DAYS   /   40 PAGES',44,59,'NSB',8.6,'accent')
    self.done()

  def intro(self):
    self.begin('여는 말')
    self.label('OPENING LETTER','잘못한 일을 바라보는 자리')
    y=391
    for paragraph in [
      '틀린 파일을 보내고, 하기로 한 일을 잊고, 마음과 다르게 말해 버리는 날이 있습니다. 그 순간에는 일어난 일을 바로잡기보다 나를 향한 평가가 더 빨리 떠오르기도 합니다.',
      '왜 이렇게 부족할까. 그 말을 반복하는 동안 무엇이 잘못됐는지 살필 힘은 줄어듭니다. 책임을 진다는 일과 스스로를 모욕하는 일은 같지 않은데도 말입니다.',
      '이 책은 어떤 실수든 괜찮다고 말하지 않습니다. 사과해야 할 일은 인정하고, 바꿀 수 있는 것은 바꾸려 합니다. 다만 한 번의 잘못으로 내 삶 전체를 결정하지 않으려 합니다.',
      '하루 한 장면을 읽고 문장을 따라 써보세요. 믿기 어려운 문장은 고쳐 써도 좋습니다. 내가 책임질 몫을 살피면서, 오늘의 나에게도 존중을 남겨 두려 합니다.'
    ]:
      y=self.wrap(paragraph,44,y,325,'NS',9.15,17.4,'ink',9)
    if y<112:raise RuntimeError(f'Opening text too long: {y}')
    self.line(44,105,CW-44,105,'faint')
    self.text('잘못한 일을 인정하는 말에도 존중은 필요합니다.',44,82,'NM',9.5,'accent')
    self.done()

    self.begin('프롤로그')
    self.label('PROLOGUE','지우개 자국이 남은 종이')
    y=390
    for paragraph in [
      '오래 쓰던 연필 끝에서 글자가 자꾸 번졌습니다. 잘못 적은 단어를 지우개로 문지르자 종이 표면이 조금 거칠어졌습니다. 새 단어를 적어도 지운 자국이 보였습니다.',
      '흔적이 남는다고 다시 쓸 수 없는 종이가 되는 것은 아닙니다. 그렇다고 지운 일이 없었던 것처럼 말할 수도 없습니다. 그 자리에 다른 글자를 적으려면 먼저 종이를 살펴야 합니다.',
      '사람 사이의 실수도 때로는 비슷합니다. 설명해야 할 일과 사과할 일, 고칠 일은 남아 있습니다. 상대가 받아들일지 내가 정할 수도 없습니다.',
      '오늘은 지운 자국을 없애려 애쓰는 대신 어디를 고칠지 살펴봅니다. 그리고 남은 여백에 지금 가능한 한 줄을 적어봅니다.'
    ]:
      y=self.wrap(paragraph,44,y,327,'NS',9.15,17.7,'ink',9)
    if y<111:raise RuntimeError(f'Prologue too long: {y}')
    self.text('남은 흔적을 보면서도 다음 문장을 쓸 수 있습니다.',44,84,'NM',9.4,'accent')
    self.done()

    self.begin('사용 안내')
    self.label('HOW TO','한 문장을 쓰는 네 가지 방법')
    methods=[
      ('01','장면 읽기','누가 잘못했는지를 서둘러 판단하지 않고 실제로 있었던 일을 읽습니다.'),
      ('02','따라 쓰기','연하게 인쇄된 문장을 천천히 씁니다. 오늘의 나와 맞지 않으면 고쳐 써도 좋습니다.'),
      ('03','내 말로 바꾸기','사실, 감정, 책임, 필요한 경계를 구별하며 납득할 수 있는 말로 적습니다.'),
      ('04','작은 수습과 선택','가능한 수습을 선택하거나, 지금은 결론을 미뤄도 되는 부분을 살펴봅니다.')
    ]
    for i,(no,heading,detail) in enumerate(methods):
      y=395-i*72
      self.text(no,44,y+1,'NM',19,'accent');self.text(heading,87,y+1,'NSB',11,'ink')
      desc_y=self.wrap(detail,87,y-23,280,'NS',9.1,15.5,'sub')
      assert desc_y>y-62, f'How-to method {no} overflow'
      self.line(44,y-52,CW-43,y-52,'faint')
    self.wrap('이 책은 자기성찰을 위한 무료 자료입니다. 피해를 축소하거나 타인의 용서를 요구하지 않습니다. 안전하지 않은 관계에서 사과나 접촉을 강요하지 않습니다. 진단이나 치료, 법률적 조언을 대신하지 않습니다.',44,95,326,'NS',7.8,13.5,'sub')
    self.done()

    self.begin('쓰기 전')
    self.label('CHECK-IN','지금 마음에 남은 장면')
    self.text('사실과 나에 대한 판단을 나누어 적어봅니다.',44,406,'NS',9.1,'sub')
    prompts=[
      '01  최근 떠오르는 실수는 어떤 일이었나요?',
      '02  그때 나에게 가장 먼저 한 말은?',
      '03  지금 확인하고 싶은 사실 한 가지는?'
    ]
    y=360
    for j,prompt in enumerate(prompts):
      self.text(prompt,44,y,'NSB',9.1,'ink');self.write_lines(y-28,2,step=21)
      self.field(f'checkin_{j+1}',45,y-69,329,42,200,True)
      y-=106
    self.text('판결보다 먼저, 사실을 한 가지 살펴봅니다.',44,64,'NM',9.8,'accent')
    self.done()

    self.begin('14일의 문장')
    self.label('CONTENTS','실수 앞에서 쓰는 열네 장면')
    self.text('오늘 마음에 남은 장면부터 펼쳐도 괜찮습니다.',44,409,'NS',8.7,'sub')
    for index,d in enumerate(DATA['days']):
      col=0 if index<7 else 1
      row=index if index<7 else index-7
      x=44 if col==0 else 219
      yy=366-row*40
      self.text(f'{d["day"]:02d}',x,yy,'NM',13.2,'accent')
      label_size=8.3
      while width(d['topic'],'NS',label_size)>118 and label_size>7.0:label_size-=.3
      self.text(d['topic'],x+32,yy+1,'NS',label_size,'ink')
      self.text(f'{7+(d["day"]-1)*2:02d}',x+154,yy+1,'NS',7.7,'sub','right')
      self.line(x,yy-14,x+155,yy-14,'faint',.55)
    self.text('7쪽부터 날짜별 에세이와 따라 쓰기 페이지가 이어집니다.',44,64,'NS',8.1,'sub')
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
    fs=9.2
    for p in d['paras']:
      y=self.wrap(p,44,y,330,'NS',fs,16.1,'ink',7.0)
    if y < 221:
       # fail rather than overwrite lower memo if long
       raise RuntimeError(f'Story overflows on day {no}: body ends at {y:.1f}')
    self.text('한 줄 장면 메모',44,207,'NSB',8.3,'accent')
    memo_size=8.7
    while width(d['memo'],'NS',memo_size)>329 and memo_size>8.0:
      memo_size-=.2
    if width(d['memo'],'NS',memo_size)>329:
      raise RuntimeError(f'Scene memo too wide on day {no}: {d["memo"]}')
    self.text(d['memo'],44,188,'NS',memo_size,'sub')
    self.write_lines(165,2,step=20)
    self.field(f'day{no:02d}_scene',44,126,329,46,160,True)
    self.text('오늘 가능한 작은 관찰  /  선택 사항',44,108,'NSB',7.9,'accent')
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
    self.text('03   내 말로 바꾸기  /  비워도 좋아요',44,202,'NSB',8.7,'accent')
    # Per-day reflection prompts are short but lengths vary. Keep readable,
    # fitting the complete prompt without truncation or awkward line wraps.
    prompt_size=9.15
    while width(d['question'],'NS',prompt_size)>329 and prompt_size>8.2:
      prompt_size-=.2
    if width(d['question'],'NS',prompt_size)>329:
      raise RuntimeError(f'Practice prompt too wide on day {no}: {d["question"]}')
    self.text(d['question'],44,182,'NS',prompt_size,'sub')
    self.write_lines(157,2,step=21)
    self.field(f'day{no:02d}_own',44,116,329,49,200,True)
    self.text('04   오늘의 작은 선택  /  빈칸도 괜찮아요',44,105,'NSB',8.7,'accent')
    self.line(44,77,375,77,'faint')
    self.field(f'day{no:02d}_step',44,73,329,24,135,False)
    self.done()

  def ending(self):
    self.begin('14일 돌아보기')
    self.label('REVIEW','후회 속에서 확인한 것')
    self.wrap('열네 날을 모두 채우지 않아도 좋습니다. 인정할 일과 바꿀 일, 나에게 남겨둘 존중을 함께 살펴봅니다.',44,410,330,'NS',9.2,17,'sub')
    prompts=[
      '01   분명하게 인정할 수 있게 된 사실',
      '02   수습하거나 바꿔 본 구체적인 행동',
      '03   나에게 더는 붙이지 않을 이름'
    ]
    y=354
    for i,p in enumerate(prompts):
      self.text(p,44,y,'NSB',8.9,'ink')
      self.write_lines(y-31,2,step=23)
      self.field(f'review_{i+1}',44,y-76,328,48,200,True)
      y-=101
    self.text('후회의 무게와 나의 가치를 따로 살펴봅니다.',44,61,'NM',9.8,'accent')
    self.done()

    self.begin('마지막 쓰기')
    self.label('MY SENTENCE','오늘 나를 존중하는 한 문장')
    self.wrap('실수한 일을 지우거나 꾸미지 않고, 그 일을 다루는 나의 태도를 한 문장으로 남겨봅니다. 내일은 다른 말을 골라도 좋습니다.',44,402,331,'NS',9.2,18,'sub')
    self.text('01   오늘의 나에게 건네고 싶은 말',44,335,'NSB',9,'accent')
    self.write_lines(299,3,step=30)
    self.field('final_sentence',44,218,330,90,250,True)
    self.text('02   그 말이 필요한 실제 장면',44,193,'NSB',9,'accent')
    self.write_lines(160,3,step=25)
    self.field('final_scene',44,99,330,66,200,True)
    self.done()

    self.begin('7일의 다시 선택')
    self.label('NEXT 7 DAYS','다음 일주일, 작은 수습 하나')
    self.text('잘했는지 점수 매기기보다 내가 바꿔 본 행동을 기록합니다.',44,410,'NS',8.7,'sub')
    self.text('이번 주에 확인하고 싶은 작은 행동',44,379,'NSB',9,'ink')
    self.line(44,351,375,351,'faint')
    self.field('experiment_action',44,346,331,26,150,False)
    self.text('7일 동안 하루 한 칸씩. 하지 못한 날은 비워도 됩니다.',44,323,'NS',8.0,'sub')
    y=299
    for i in range(7):
      self.text(f'{i+1:02d}',46,y+2,'NM',10,'accent')
      self.line(80,y,375,y,'faint')
      self.field(f'experiment_day_{i+1}',81,y-5,290,22,130,False)
      y-=30
    self.text('일주일 뒤 다시 물어볼 질문은 무엇인가요?',44,88,'NSB',8.6,'accent')
    self.line(44,64,375,64,'faint')
    self.field('experiment_decision',44,60,329,23,150,False)
    self.done()

    self.begin('여백')
    self.label('BLANK PAGE','한 번 더 써볼 여백')
    self.wrap('여기에는 사과, 배운 것, 아직 풀리지 않은 마음 중 무엇을 적어도 좋습니다. 비워 두어도 괜찮습니다.',44,402,330,'NS',9.4,18,'sub')
    for y in range(335,83,-29):self.line(44,y,375,y,'faint')
    self.field('blank_notes',44,79,331,270,650,True)
    self.done()

    self.begin('에필로그')
    self.label('EPILOGUE','다시 쓴다는 일')
    y=394
    for paragraph in [
      '책상 위에 있던 종이를 다시 펼쳤습니다. 지웠던 자리에 연필 자국이 남아 있었습니다. 같은 종이 위에 새로운 문장을 적었습니다.',
      '어떤 잘못은 바로 고칠 수 있습니다. 어떤 일은 시간이 필요하고, 어떤 일은 끝내 돌릴 수 없을지도 모릅니다. 잘못이 있었다는 사실을 흐리지 않는 것이 먼저일 때도 있습니다.',
      '그 사실을 인정한 뒤에도 나에게 건넬 말은 남아 있습니다. 다음에는 무엇을 확인할지, 누구의 말을 더 들어야 할지, 어떤 도움을 구할지 물을 수 있습니다.',
      '다시 쓴다는 일은 처음부터 완벽했다는 뜻이 아닙니다. 어제의 문장을 들여다보고, 오늘의 책임을 살피고, 내일의 한 줄을 선택하는 일입니다.'
    ]:
      y=self.wrap(paragraph,44,y,327,'NS',9.2,17.8,'ink',10)
    if y<106:raise RuntimeError(f'Epilogue too long: {y}')
    self.line(44,103,CW-44,103,'faint')
    self.text('잘못을 인정한 오늘에도, 다음 한 줄은 남아 있습니다.',44,76,'NM',9.4,'accent')
    self.done()

    self.begin('NAL MIND TOOLS')
    self.text('NAL MIND TOOLS    /    VOL. 07',44,498,'NSB',9.3,'accent')
    self.text('잘못을 지우는 말보다,',44,432,'NMB',19.0,'ink')
    self.text('나를 함부로 부르지 않는 말.',44,393,'NMB',17.2,'ink')
    self.line(44,360,375,360,'faint')
    vols=[
      '01   긍정문장 따라 쓰기  /  자기이해',
      '02   관계 속에서도 나를 잃지 않는 말  /  관계',
      '03   작은 시작을 믿는 말  /  선택과 실행',
      '04   지친 날에도 나를 돌보는 말  /  회복과 자기돌봄',
      '05   오늘의 작은 기쁨을 발견하는 말  /  일상과 감사',
      '06   낯선 내일에도 나를 믿는 말  /  변화와 불확실성',
      '07   실수한 날에도 나를 존중하는 말  /  실수와 자기용서',
    ]
    for j,t in enumerate(vols):
      fontsize=8.4
      while width(t,'NS',fontsize)>331 and fontsize>6.9:fontsize-=.2
      self.text(t,44,324-j*27,'NS',fontsize,'ink' if j==6 else 'sub')
    self.wrap('날빛은 긍정을 강요하기보다, 실제로 있었던 일을 바르게 바라보고 오늘의 말을 다시 고르는 시간을 만들고자 합니다.',44,125,323,'NS',8.0,14,'sub')
    self.wrap('무료 개인용 워크북입니다. 개인 열람·인쇄 가능, 파일의 재판매·재업로드·무단 재배포는 허용하지 않습니다. 심리 진단이나 치료를 대신하지 않습니다.',44,85,328,'NS',7.1,12.1,'sub')
    self.text('긍정문장 시리즈 07  ·  무료 마음도구 전체 10',44,55,'NS',7.3,'sub')
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
    from pypdf.generic import NameObject, DictionaryObject, TextStringObject, BooleanObject, NumberObject
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
      'title':'NAL 긍정문장 따라 쓰기 07 - 실수한 날에도 나를 존중하는 말 (v1.1)',
      'author':'DAILYCOACHING · NAL',
      'subject':'NAL 긍정문장 시리즈 07 · 무료 마음도구 10 · 14일 따라 쓰기 · 디지털 입력형',
      'keywords':'NAL, 날빛, 긍정문장, 따라쓰기, 실수, 후회, 책임, 자기존중, 무료 워크북',
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
        annotation[NameObject('/Q')]=NumberObject(0)
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
      '/Title':'NAL 긍정문장 따라 쓰기 07 - 실수한 날에도 나를 존중하는 말 (v1.1)',
      '/Author':'DAILYCOACHING · NAL',
      '/Subject':'날빛 긍정문장 시리즈 07 · 무료 마음도구 10 · 디지털 입력형',
      '/Keywords':'날빛, 긍정문장, 따라쓰기, 실수, 자기존중, 무료 PDF',
      '/Creator':'NAL Mind Tools Editorial',
    })
    # Give every text widget its own normal-appearance stream. PyMuPDF
    # deduplicates identical blank appearances across 14 days; PDF editors
    # would otherwise repaint several unrelated fields with the same value.
    from pypdf.generic import DecodedStreamObject
    unique_appearance_count=0
    for page in writer.pages:
      for ref in page.get('/Annots',[]):
        widget=ref.get_object()
        if widget.get('/Subtype')!='/Widget':continue
        ap=widget.get('/AP')
        if not ap or '/N' not in ap:continue
        old_stream=ap['/N'].get_object()
        stream=DecodedStreamObject()
        for key,value in old_stream.items():
          if str(key) not in ('/Length','/Filter','/DecodeParms'):
            stream[key]=value
        stream.set_data(old_stream.get_data())
        ap[NameObject('/N')]=writer._add_object(stream)
        unique_appearance_count+=1
    assert unique_appearance_count==len(self.fields)==74
    with open(formdone,'wb') as f:
      writer.write(f)
    formdone.replace(self.path)
    raw.unlink(missing_ok=True)
    fonted.unlink(missing_ok=True)
    print('EMBEDDED Korean font for',count,'form fields')


def store_cover():
  W,H=1200,1600
  img=Image.new('RGB',(W,H),PAPER);d=ImageDraw.Draw(img)
  d.rectangle((0,0,W,490),fill=MOSS)
  def pf(size,bold=False,serif=False):
    p=font_files['NMB' if bold and serif else 'NM' if serif else 'NSB' if bold else 'NS']
    return ImageFont.truetype(p,size)
  def tx(x,y,t,size,color,serif=False,bold=False,anchor=None):
    d.text((x,y),t,font=pf(size,bold,serif),fill=color,anchor=anchor)
  tx(108,103,'NAL   /   긍정문장 시리즈 07',33,'#FFF9F7',bold=True)
  d.line((108,175,251,175),fill='#F8EDE7',width=4)
  tx(108,235,'MISTAKES, REPAIR, RESPECT',30,'#F9E9E2')
  tx(108,335,'잘못한 일을 고치되 나를 함부로 부르지 않는 시간',32,'#FFF7F1',serif=True)
  tx(108,598,'긍정문장',104,INK,serif=True,bold=True)
  tx(108,724,'따라 쓰기',104,INK,serif=True,bold=True)
  tx(1091,756,'07',90,MOSS,serif=True,anchor='ra')
  d.line((108,859,1092,859),fill=FAINT,width=3)
  tx(108,930,'실수한 날에도',72,INK,serif=True,bold=True)
  tx(108,1033,'나를 존중하는 말',72,INK,serif=True,bold=True)
  tx(108,1206,'실수와 후회를 지나,',34,MOSS)
  tx(108,1260,'책임과 자기존중을 함께 살피는 14일',34,MOSS)
  tx(108,1500,'FREE MIND TOOL 10   /   14 DAYS   /   40 PAGES',28,MOSS,bold=True)
  img.save(COVER,optimize=True)
  return img

def run():
  assert DATA['volume']==7 and len(DATA['days'])==14
  assert len(set(day['sentence'] for day in DATA['days']))==14
  store_cover()
  Book(PDF_A5,Variant()).build()
  Book(PDF_A4,Variant(grayscale=True)).build()
  Book(PDF_FORM,Variant(digital=True)).build()
  slug='nal-positive-writing-07-self-respect'
  details={
    'schemaVersion':'2.0','releaseStatus':'asset-ready / not published',
    'proposedAssetPaths':{
      'A5':f'/nal/assets/downloads/free/{slug}-v11-a5.pdf',
      'A4':f'/nal/assets/downloads/free/{slug}-v11-a4-print.pdf',
      'fill':f'/nal/assets/downloads/free/{slug}-v11-fillable.pdf',
      'cover':f'/nal/assets/images/catalog/shop/retail/{slug}-v11-cover.png',
    },
    'product':{
      'id':slug,'slug':slug,'title':DATA['title'],'subtitle':DATA['subtitle'],'author':DATA['author'],
      'summary':'실수와 후회 앞에서 책임을 인정하면서 자신을 함부로 단정하지 않도록 돕는 14일 필사 워크북.',
      'description':'실수를 지우거나 무조건 괜찮다고 덮지 않습니다. 사실과 자기평가의 구분, 사과와 기다림, 후회의 반복, 내 책임과 다른 사람의 몫, 다시 선택하는 방법을 에세이·긍정문장·필사·기록으로 살피는 NAL 일곱 번째 무료 워크북입니다.',
      'category':'날빛 작은 책 · 무료',
      'tags':['날빛','긍정문장','따라쓰기','실수','후회','자기존중','책임','자기용서','무료 워크북'],
      'coverImage':f'/nal/assets/images/catalog/shop/retail/{slug}-v11-cover.png',
      'coverImageAlt':'웜테라코타·아이보리 타이포그래피 NAL 긍정문장 시리즈 07 실수한 날에도 나를 존중하는 말 표지',
      'gallery':[],'galleryAlts':[], 'price':0,'originalPrice':None,
      'productType':'pdfWorkbook','deliveryType':'digital','stock':None,'stockStatus':'comingSoon',
      'options':[], 'components':['A5 컬러 소책자 PDF · 40쪽','A4 흑백 인쇄판 PDF · 40쪽','한글 디지털 입력형 PDF · 40쪽','14일 필사와 7일 다시 선택 기록'],
      'cardCount':None,'pageCount':40,
      'recommendedFor':['실수를 떠올릴 때 나 자신까지 부정하게 되는 사람','잘못을 인정하되 다른 사람의 몫도 구분하고 싶은 사람','후회를 반복하는 대신 다음 행동을 정하고 싶은 사람'],
      'usageIndividual':'하루 한 장면을 읽고 문장을 따라 쓴 뒤 지금의 나에게 맞게 바꿉니다. 사과와 접촉은 상황이 적절하고 안전할 때에만 선택합니다. 순서를 바꾸거나 빈칸으로 두어도 됩니다.',
      'usageCouple':None,'usageGroup':None,
      'precautions':'자기성찰을 위한 무료 자료입니다. 피해나 책임을 축소하지 않으며 타인의 용서와 연락을 강요하지 않습니다. 심리·건강 진단, 치료 또는 법률 자문을 대신하지 않습니다. 개인 열람·인쇄 가능, 무단 재판매·재업로드·재배포 금지.',
      'visualNote':'웜테라코타·아이보리 타이포그래피 표지, 긍정문장 시리즈 07 / 무료 마음도구 10.',
      'shippingPolicy':None,'exchangePolicy':None,'refundPolicy':'무료 제공 콘텐츠로 결제 및 환불 대상이 아닙니다.',
      'purchaseUrl':None,'sampleUrl':None,'previewUrl':None,'sourceUrl':None,
      'relatedProgramIds':[],'relatedContentIds':[], 'featured':False,'featuredOrder':None,'published':False,
      'createdAt':'2026-10-13','updatedAt':'2026-10-13',
      'fileFormat':'PDF','fileSizeMB':round(PDF_A5.stat().st_size/1_000_000,2),
      'deliveryMethod':'digital-download','licenseType':'personal-use','printingAllowed':True,
      'downloadLimit':None,'accessPeriod':'제한 없음',
      'fulfillmentNote':'무료 파일 제작 완료 상태입니다. 스토어 공개 전 다운로드 파일의 최종 브라우저·앱 검증이 필요합니다.',
      'audiences':['개인'],'topics':['자기이해','감정','글쓰기'],
      'tableOfContents':['여는 말','프롤로그','사용 안내','쓰기 전 체크인']+
        [f"{d['day']:02d} {d['topic']}" for d in DATA['days']]+['14일 돌아보기','나의 한 문장','7일 다시 선택','에필로그'],
      'licenseOptions':[],'version':'1.1-free','policyStatus':'reviewed','policyVersion':None,
      'freeDownloads':[
        {'label':'A5 컬러 소책자','description':'읽기와 필사를 위한 40쪽 컬러 PDF','url':f'/nal/assets/downloads/free/{slug}-v11-a5.pdf'},
        {'label':'A4 흑백 인쇄판','description':'출력해 손글씨로 기록하는 40쪽 PDF','url':f'/nal/assets/downloads/free/{slug}-v11-a4-print.pdf'},
        {'label':'디지털 한글 입력형','description':'PDF 양식 지원 앱에서 입력하는 40쪽 PDF · 기기별 호환성 확인','url':f'/nal/assets/downloads/free/{slug}-v11-fillable.pdf'},
      ]
    }
  }
  (HERE/'NAL_07_스토어상품정보_v1.1.json').write_text(json.dumps(details,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  notes='''NAL · 날빛 | 긍정문장 따라 쓰기 07
실수한 날에도 나를 존중하는 말 · v1.1

14일 · 14개 문장 · 총 40쪽 · 무료

A5 컬러 소책자: 휴대폰·태블릿 읽기 및 A5 인쇄
A4 흑백 인쇄판: A4 용지에 출력해 손글씨 기록
디지털 한글 입력형: PDF 양식 지원 앱에서 작성 후 저장

읽기 → 따라 쓰기 → 내 말로 바꾸기 → 오늘의 작은 선택.
실수를 무조건 괜찮다고 할 필요는 없습니다. 책임질 몫은 살피되 나를 향한 모욕적인 말은 줄여봅니다.
용서와 사과, 관계 회복은 상대의 선택과 상황을 존중하며 안전한 경우에만 고려합니다.

PDF 입력형은 작성 후 저장·닫기·재열기로 글자를 확인하세요. 일부 앱에서 글꼴을 교체하면 한글 간격이 달라질 수 있습니다.
입력에 어려움이 있다면 소책자 PDF를 필기 앱에서 쓰거나 A4로 출력해 주세요.

개인 열람·인쇄용 무료 자료입니다. 재판매·재업로드·무단 재배포 금지.
심리·건강 진단, 치료 또는 법률 자문을 대신하지 않습니다.

DAILYCOACHING · NAL · 날빛 / 2026.10
'''
  (HERE/'읽어주세요_고객용_v1.1.txt').write_text(notes,encoding='utf-8')
  (HERE/'README_운영자용_v1.1.md').write_text('''# NAL 긍정문장 따라 쓰기 07 · v1.1

- 제목: 실수한 날에도 나를 존중하는 말 / 실수·후회·책임·자기존중
- PDF 3종 40쪽, 14일 에세이와 필사, 입력형 AcroForm 74개 입력 필드.
- 품질 테스트: 본문 렌더링·페이지 경계·문장 누락·입력값 독립·한글 저장 확인.
- 배포: 고객용 PDF 3종과 이용 안내만 포함; 운영자용에는 원고·제작 코드·표지·상품등록 초안 포함.
- 참고: Android·Acrobat 앱별 호환과 A4 실물 인쇄는 별도 현장 검증 필요.
- 공개 상태: NAL 스토어 미등록. 본 파일 링크는 고객용 다운로드 URL이 아님.
''',encoding='utf-8')
  with zipfile.ZipFile(BUNDLE,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as bundle:
    for item in [PDF_A5,PDF_A4,PDF_FORM,HERE/'읽어주세요_고객용_v1.1.txt']:
      bundle.write(item,arcname=item.name)
  print('BUNDLE',BUNDLE.name,BUNDLE.stat().st_size,'bytes')

if __name__=='__main__':run()
