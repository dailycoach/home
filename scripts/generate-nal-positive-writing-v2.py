# -*- coding: utf-8 -*-
"""NAL · 날빛 긍정문장 따라쓰기: improved production v2.
Generate an A5 editorial edition, A4 high-legibility print edition,
a keyboard-fillable edition, and a store cover image.
"""
import os, math, io, textwrap, zipfile
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A5, A4
from reportlab.lib.colors import HexColor
import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1] / '.nal-positive-writing-generated'
OUT=ROOT
OUT.mkdir(parents=True, exist_ok=True)
FONTS={
 'Sans':'/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf',
 'SansBold':'/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf',
 'Serif':'/usr/share/fonts/truetype/nanum/NanumMyeongjo.ttf',
 'SerifBold':'/usr/share/fonts/truetype/nanum/NanumMyeongjoBold.ttf'
}
for n,path in FONTS.items():pdfmetrics.registerFont(TTFont(n,path))

DAYS=[
 dict(topic='나를 바라보기',title='괜찮다는 말이 어려운 아침',
      sentence='나는 지금의 나로 오늘을 시작해도 괜찮다.',
      paras=[
          '아침에 눈을 뜨자마자 아직 하지 못한 일이 먼저 떠오를 때가 있습니다. 어제의 목록과 오늘의 약속이 이불 밖으로 나오기도 전에 마음을 채웁니다.',
          '그런 날에는 “잘할 수 있어”라는 응원도 무겁게 느껴집니다. 잘하는 나를 먼저 만들어야 하루를 시작할 자격이 생기는 것 같아서요.',
          '조금 작은 말로 바꾸어봅니다. 지금의 나를 고쳐 놓지 않아도, 오늘은 시작할 수 있습니다. 출발선에는 완벽한 사람만 서는 것이 아니니까요.'
      ],question='하루를 시작할 때, 나는 나에게 어떤 말을 먼저 건네나요?',
      step='첫 할 일 전에 잠깐 숨을 고르고 내 상태를 살펴보기'),
 dict(topic='쉼을 허락하기',title='멈춘 자리도 하루의 일부',
      sentence='쉬는 동안에도 나는 나를 돌보고 있다.',
      paras=[
          '잠깐 앉아 쉬면서도 휴대전화를 확인하고, 끝나지 않은 일을 머릿속으로 세어봅니다. 몸은 멈췄는데 마음은 여전히 달리는 날이 있습니다.',
          '쉼을 모든 일을 끝낸 뒤에 받는 상처럼 생각하면, 휴식은 자꾸 뒤로 밀립니다. 그러나 우리의 몸과 마음은 완료 표시가 생길 때까지 기다려주지 않습니다.',
          '물 한 잔을 마시고 창밖을 바라보는 몇 분도 하루를 돌보는 시간이 될 수 있습니다. 오늘의 쉼을 굳이 변명하지 않아도 좋겠습니다.'
      ],question='오늘 내게 허락할 수 있는 가장 짧은 쉼은 무엇인가요?',
      step='3분 동안 화면을 내려놓고 몸의 긴장을 살펴보기'),
 dict(topic='작게 시작하기',title='시작은 처음부터 크지 않아도',
      sentence='오늘은 작은 일 하나부터 시작해도 된다.',
      paras=[
          '책상 한쪽에 며칠째 같은 메모가 있습니다. 해야 한다는 마음은 큰데 막상 시작하려니 첫 손길이 무겁습니다.',
          '처음부터 끝까지 잘하겠다고 마음먹을수록 문턱이 높아집니다. 그때 필요한 것은 더 거창한 결심이 아니라 손에 잡히는 아주 작은 행동일지 모릅니다.',
          '파일을 열고, 첫 문장을 적고, 필요한 사람에게 짧은 메시지 하나를 보냅니다. 작은 시작이 결과를 보장하지는 않습니다. 다만 오늘의 방향을 살짝 바꿀 수는 있습니다.'
      ],question='지금 5분 안에 해볼 수 있는 일 하나는 무엇인가요?',
      step='미뤄둔 일의 첫 동작만 5분 동안 해보기'),
 dict(topic='마음 알아차리기',title='마음이 보내는 작은 신호',
      sentence='나는 내 마음이 보내는 신호를 천천히 살핀다.',
      paras=[
          '별일 아닌 말 한마디가 자꾸 떠오를 때가 있습니다. 누구에게 설명하기엔 작지만, 내 마음에는 오래 남아 있는 장면입니다.',
          '빨리 좋은 기분으로 바뀌어야 한다고 다그치면 서운함이나 답답함은 더 숨을 곳이 없어집니다. 불편한 감정까지 없애는 것이 꼭 긍정은 아닙니다.',
          '“아직 마음에 남아 있구나.” 그렇게 한 번 알아차립니다. 이름이 정확하지 않아도 됩니다. 마음이 하는 말을 먼저 들어보는 것입니다.'
      ],question='지금 내 마음에 가장 가까운 단어는 무엇인가요?',
      step='감정에 이름 하나 붙이고 그대로 두어보기'),
 dict(topic='나의 속도 찾기',title='다른 사람의 시간표가 아닌',
      sentence='나는 내게 맞는 속도로 걸어가도 된다.',
      paras=[
          '화면 속 누군가는 늘 다음 단계로 가는 것처럼 보입니다. 무언가를 시작하고 끝낸 이야기가 끝없이 올라옵니다.',
          '그 모습을 오래 보고 있으면 내 하루는 제자리에 멈춘 듯합니다. 하지만 우리는 서로 다른 짐을 들고 서로 다른 길을 걷고 있습니다.',
          '오늘 내게 필요한 것은 빠른 걸음일까요, 아니면 내가 향하는 곳을 다시 보는 일일까요. 속도를 정하기 전에 방향부터 살펴도 좋겠습니다.'
      ],question='지금 나에게 더 필요한 것은 속도인가요, 방향인가요?',
      step='비교 대신 지금의 목적을 한 줄로 적어보기'),
 dict(topic='실수 이후의 나',title='한 장면이 나 전체는 아닙니다',
      sentence='나는 실수한 뒤에도 다시 선택할 수 있다.',
      paras=[
          '보내지 말았어야 할 말을 보내거나 중요한 일을 놓친 날이 있습니다. 그 장면은 이미 지나갔는데 머릿속에서는 여러 번 다시 시작됩니다.',
          '실수를 돌아보는 일과 나라는 사람을 한 장면으로 판단하는 일은 다릅니다. 책임져야 할 부분은 살피되, 나를 포기할 필요까지는 없습니다.',
          '사과가 필요하면 사과하고, 고칠 수 있는 것은 고쳐봅니다. 오늘의 나는 그다음 선택을 할 수 있는 사람입니다.'
      ],question='최근의 실수에서 내가 배운 것 한 가지는 무엇인가요?',
      step='바꿀 수 있는 행동 한 가지를 골라 적기'),
 dict(topic='경계 세우기',title='부드럽고 분명한 한마디',
      sentence='나는 나를 지키는 말을 차분히 건넬 수 있다.',
      paras=[
          '누군가 부탁하면 “네, 괜찮아요”라는 말이 먼저 나올 때가 있습니다. 대답은 빨랐는데 마음은 한참 뒤따라옵니다.',
          '관계를 소중히 여기는 것과 나의 한계를 살피는 것은 서로 반대되는 일이 아닙니다. 모든 부탁을 들어주지 않아도 관계를 이어갈 길은 있습니다.',
          '“지금은 어렵습니다.” “생각해보고 답할게요.” 작고 분명한 말 하나가 나를 지키고 상대를 존중하는 출발이 되기도 합니다.'
      ],question='내가 연습해보고 싶은 정중한 거절 한마디는 무엇인가요?',
      step='대답하기 전에 3초 멈추는 연습'),
 dict(topic='마음 표현하기',title='크게 말하기보다 정확하게',
      sentence='나는 내 마음을 작고 정확한 말로 전할 수 있다.',
      paras=[
          '마음이 복잡한 날에는 “항상”, “전부” 같은 단어가 쉽게 나옵니다. 하지만 그 큰 말 뒤에는 보통 작고 구체적인 장면이 있습니다.',
          '답을 기다렸는데 오지 않아 서운했다거나 혼자 결정해야 해서 부담스러웠던 순간처럼요. 상황을 조금 더 정확하게 말하면 나도 내가 원하는 것을 보기 쉬워집니다.',
          '상대를 단정하기 전에 내가 경험한 한 장면을 꺼내봅니다. “나는 그때 조금 서운했어.” 그만큼의 말로도 충분할 때가 있습니다.'
      ],question='오늘 내가 조금 더 정확하게 표현하고 싶은 마음은 무엇인가요?',
      step='“너는 항상” 대신 “나는 그때”로 시작해보기'),
 dict(topic='비교에서 돌아오기',title='내 안의 작고 실제적인 변화',
      sentence='나는 내 안의 작은 변화에도 눈길을 준다.',
      paras=[
          '다른 사람의 성과를 보고 있으면 내가 지나온 시간은 잘 보이지 않습니다. 지난달보다 덜 망설였던 일, 전보다 일찍 도움을 구한 일도 쉽게 잊힙니다.',
          '남의 하루에는 내가 보지 못한 시간이 있고, 나의 하루에도 남이 알 수 없는 수고가 있습니다. 비교는 종종 그 시간을 지웁니다.',
          '오늘은 시선을 조금 돌립니다. 거창하지 않아도 실제로 달라진 것이 하나쯤 있을지 살펴봅니다. 그것을 기억하는 일도 나를 알아가는 방법입니다.'
      ],question='지난달의 나와 비교해 달라진 작은 행동은 무엇인가요?',
      step='최근 달라진 습관이나 태도 하나 적기'),
 dict(topic='돌봄을 묻기',title='필요한 것을 먼저 묻는 저녁',
      sentence='나는 지금 내게 필요한 것이 무엇인지 묻는다.',
      paras=[
          '바쁜 하루를 보내고 나서야 배가 고팠다는 사실을 알아차릴 때가 있습니다. 어깨가 뻐근했다는 것도, 조용한 시간이 필요했다는 것도 뒤늦게 보입니다.',
          '우리는 부족한 점을 먼저 찾는 데 익숙합니다. 그런데 그보다 앞서 물어볼 질문이 있습니다. “지금 나에게 필요한 것은 무엇일까?”',
          '물 한 잔인지, 잠깐 걸을 시간인지, 누군가의 말인지. 대답이 바로 나오지 않아도 좋습니다. 묻는 일 자체가 돌봄의 시작이 될 수 있으니까요.'
      ],question='오늘 내 몸과 마음이 먼저 바라는 것은 무엇인가요?',
      step='물·쉼·움직임 중 필요한 한 가지 실천하기'),
 dict(topic='한 걸음 선택하기',title='답을 다 몰라도 고를 수 있어요',
      sentence='나는 모든 답을 몰라도 한 걸음을 고를 수 있다.',
      paras=[
          '충분히 생각한 뒤에도 결정이 어려울 때가 있습니다. 선택하지 않은 길이 마음에 남고, 실수할까 봐 같은 질문만 반복됩니다.',
          '인생 전체의 답을 지금 정하려 하면 오늘 가능한 작은 선택까지 멈추게 됩니다. 지금 알고 있는 사실로 해볼 수 있는 일 하나를 찾아봅니다.',
          '오늘의 선택은 최종 판결이 아닙니다. 움직여보고, 살펴보고, 필요하면 다시 고르면 됩니다.'
      ],question='완벽하지 않아도 오늘 선택할 수 있는 작은 일은 무엇인가요?',
      step='미뤄둔 선택 중 아주 작은 것 하나 결정해보기'),
 dict(topic='도움 청하기',title='혼자만의 힘으로 버티지 않아도',
      sentence='나는 필요할 때 도움을 청할 수 있다.',
      paras=[
          '할 일이 많아도 “내가 해야지”라는 말이 먼저 나올 때가 있습니다. 부탁이 누군가에게 부담이 될까 봐 입을 다물기도 합니다.',
          '하지만 도움을 청하는 일은 책임을 피하는 것과 다릅니다. 내가 맡은 일을 더 잘 이해하기 위해 다른 사람의 힘을 빌리는 순간도 있습니다.',
          '“이 부분을 함께 봐줄 수 있을까요?” 부탁을 말로 꺼내는 동안 내가 정말 필요했던 것이 무엇인지 분명해지기도 합니다.'
      ],question='내가 도움을 청할 수 있는 사람과 부탁은 무엇인가요?',
      step='도움이 필요한 부분을 한 문장으로 정리하기'),
 dict(topic='미완성 존중하기',title='고치는 중인 사람으로 살아가기',
      sentence='나는 아직 완성되지 않은 나도 존중한다.',
      paras=[
          '새로운 것을 배우는 동안에는 아직 모르는 것들이 자꾸 눈에 들어옵니다. 하나를 해내면 또 다른 부족함이 보이기도 합니다.',
          '더 나아지고 싶은 마음은 소중하지만, 그 마음 때문에 지금의 내가 늘 임시 상태가 되는 것은 아닙니다. 배우는 동안에도 삶은 계속됩니다.',
          '바꾸고 싶은 점은 적어두되 오늘의 나에게도 자리를 내어줍니다. 미완성이라는 이유로 존재까지 미뤄지는 것은 아니니까요.'
      ],question='배우는 중인 나에게 지금 어떤 말을 건네고 싶나요?',
      step='잘한 일 하나와 배우는 일 하나를 나란히 적기'),
 dict(topic='작은 변화 기억하기',title='오늘의 끝에 남기는 한 줄',
      sentence='나는 오늘 해낸 작은 일을 기억한다.',
      paras=[
          '잠들기 전에는 끝내지 못한 일이 더 크게 떠오릅니다. 이미 한 일은 너무 당연해서, 하루의 기록에서 빠지기 쉽습니다.',
          '미뤄둔 연락을 한 일, 제때 밥을 챙긴 일, 어려운 마음을 잠깐 알아차린 일도 오늘 안에 있었습니다. 꼭 큰 성과만 남길 필요는 없습니다.',
          '적어두지 않으면 지나갈 만큼 작은 일을 하나 골라봅니다. 내일의 목록을 시작하기 전에 오늘의 흔적을 남겨두는 것입니다.'
      ],question='오늘 내가 지나치지 않고 기억하고 싶은 일은 무엇인가요?',
      step='오늘의 작은 성취를 한 줄로 남기기'),
]
assert len(DAYS)==14

A5W,A5H=A5
THEMES={
 'color': dict(bg='#F8F7F3',paper='#FFFEFB',text='#283146',blue='#496795',muted='#6D7580',faint='#D9DDE1',ghost='#B4BCC4',dark='#25314B',white='#FCFCFC'),
 'mono': dict(bg='#FFFFFF',paper='#FFFFFF',text='#242424',blue='#383838',muted='#646464',faint='#C9C9C9',ghost='#B1B1B1',dark='#262626',white='#FFFFFF')
}

class Book:
 def __init__(self,out,size,style='color'):
  self.path=out; self.W,self.H=size; self.scale=self.W/A5W
  self.c=canvas.Canvas(str(out), pagesize=size,pageCompression=1)
  self.c.setTitle('긍정문장 따라 쓰기 | NAL · 날빛 무료 마음도구 v2')
  self.c.setAuthor('NAL · 날빛')
  self.c.setSubject('14일 동안 읽고, 따라 쓰고, 내 말로 남기는 긍정문장 워크북')
  self.c.setKeywords('NAL,날빛,긍정문장,따라쓰기,무료,14일,마음도구,셀프코칭')
  self.style=style; self.t=THEMES[style]; self.page=0
 def pt(self,v):return v*self.scale
 def fill(self,color):self.c.setFillColor(HexColor(color))
 def stroke(self,color):self.c.setStrokeColor(HexColor(color))
 def line(self,x1,t1,x2,t2,color=None,lw=.6):
  self.stroke(color or self.t['faint']);self.c.setLineWidth(self.pt(lw));self.c.line(self.pt(x1),self.H-self.pt(t1),self.pt(x2),self.H-self.pt(t2))
 def rect(self,x,top,w,h,fill,stroke=None):
  self.fill(fill); self.c.setStrokeColor(HexColor(stroke or fill));self.c.rect(self.pt(x),self.H-self.pt(top+h),self.pt(w),self.pt(h),stroke=int(bool(stroke)),fill=1)
 def text(self,x,t,text,font='Sans',size=10,color=None,align='left'):
  self.fill(color or self.t['text']);self.c.setFont(font,self.pt(size))
  cb={'left':self.c.drawString,'right':self.c.drawRightString,'center':self.c.drawCentredString}[align]
  cb(self.pt(x), self.H-self.pt(t), text)
 def width(self,s,font,size):return pdfmetrics.stringWidth(s,font,size)
 def split_text(self,text,font,size,maxw):
  # Unicode-aware word wrapping; never allow a line past max width.
  chunks=[]; words=text.split(' ');cur=''
  for w in words:
   candidate=(cur+' '+w).strip()
   if self.width(candidate,font,size)<=maxw:cur=candidate;continue
   if cur:chunks.append(cur);cur=''
   if self.width(w,font,size)<=maxw:cur=w;continue
   for ch in w:
    test=cur+ch
    if self.width(test,font,size)>maxw and cur:chunks.append(cur);cur=ch
    else:cur=test
  if cur:chunks.append(cur)
  return chunks
 def paragraph(self,x,t,paragraph,font='Sans',size=10,leading=18,width=330,color=None):
  lines=self.split_text(paragraph,font,size,width)
  for idx,line in enumerate(lines):self.text(x,t+leading*idx,line,font,size,color)
  return t + len(lines)*leading
 def heading(self,top,tag,title,subtitle=None):
  self.text(44,top,tag,'SansBold',8,self.t['blue'])
  lines=self.split_text(title,'SerifBold',21.5,337)
  for i,s in enumerate(lines):self.text(44,top+34+29*i,s,'SerifBold',21.5)
  v=top+34+29*(len(lines)-1)
  if subtitle:self.text(44,v+27,subtitle,'Sans',9.3,self.t['muted'])
  return v
 def base(self,sect='',dark=False):
  self.page+=1
  self.rect(0,0,A5W,A5H,self.t['bg'])
  if not dark:
   self.text(44,37,'NAL · 날빛   /   FREE MIND TOOL 04','SansBold',7.1,self.t['muted'])
   self.text(A5W-43,37,sect,'Sans',7.1,self.t['muted'],align='right')
   self.line(44,50,A5W-44,50,lw=.55)
  else:pass
 def footer(self):
  self.line(44,550,A5W-44,550,lw=.45)
  self.text(44,566,'NAL · 날빛','Sans',7.3,self.t['muted'])
  self.text(A5W-44,566,f'{self.page:02d}','Sans',7.3,self.t['muted'],align='right')
 def done(self,footer=True):
  if footer:self.footer()
  self.c.showPage()
 def ruled(self,top,n=2,width=330,spacing=31,x=44):
  for i in range(n):self.line(x,top+i*spacing,x+width,top+i*spacing,lw=.65)
 def micro_label(self,t,index,s):
  self.text(44,t,index,'SansBold',8,self.t['blue'])
  self.text(68,t,s,'SansBold',9,self.t['text'])

 def build(self):
  c=self.c;t=self.t
  # 01 cover. restrained typographic surface
  self.base('');
  cover_tone = t['dark'] if self.style == 'color' else t['bg']
  cover_ink = t['white'] if self.style == 'color' else t['text']
  if self.style == 'color':
   self.rect(0,0,A5W,190,cover_tone)
  else:
   self.rect(0,0,A5W,190,t['bg'])  # clear ordinary running header on print cover
   self.line(43,70,A5W-44,70,t['text'],1.1)
   self.line(43,182,A5W-44,182,t['faint'],.5)
  self.text(43,56,'NAL  /  날빛 작은 책 04','SansBold',9,cover_ink)
  self.line(43,83,97,83,cover_ink,.75)
  self.text(43,119,'읽고, 따라 쓰고,','Serif',15.5,cover_ink)
  self.text(43,150,'나의 말로 남기는 시간','Serif',15.5,cover_ink)
  self.text(43,276,'긍정문장','SerifBold',33,t['text'])
  self.text(43,329,'따라 쓰기','SerifBold',33,t['text'])
  self.text(44,371,'내게 건네는 14개의 문장','SansBold',11,t['blue'])
  self.line(44,408,A5W-44,408,t['faint'],.85)
  self.text(44,447,'믿기 어려운 말 대신,','Sans',10,t['muted'])
  self.text(44,469,'오늘의 내가 적을 수 있는 말부터.','Sans',10,t['muted'])
  self.text(44,548,'FREE WORKBOOK   ·   14 DAYS','SansBold',8,t['blue'])
  self.done(footer=False)
  # 02 pause
  self.base('첫 문장');
  self.text(44,143,'여는 문장','SansBold',9,t['blue'])
  self.text(44,197,'괜찮아지라는 말보다,','SerifBold',20)
  self.text(44,231,'나를 지나치지 않는 말.','SerifBold',20)
  self.line(44,276,110,276,t['blue'],.9)
  self.paragraph(44,372,'마음이 바로 따라오지 않아도 됩니다. 어색한 문장은 조금 바꾸어 적어도 좋습니다.',size=10.4,leading=20,width=318,color=t['muted'])
  self.paragraph(44,443,'이 책은 나를 설득하기보다, 오늘의 나와 대화하기 위해 만들어졌습니다.',size=10.4,leading=20,width=318,color=t['muted'])
  self.done()
  # 03 preface
  self.base('프롤로그')
  self.heading(100,'프롤로그','나를 믿게 되는 말에는 각자의 속도가 있습니다.')
  v=232
  for paragraph in [
   '“나는 잘하고 있어.” 누군가에게는 쉬운 문장이 어떤 날의 나에게는 멀게 느껴집니다. 마음이 따라오지 않는데 글자만 앞서가는 것 같아서요.',
   '이 책의 문장은 큰 확신을 약속하지 않습니다. 대신 일상에서 확인할 수 있는 작고 정확한 말을 모았습니다. 잠깐 쉬어도 된다는 말, 다시 선택할 수 있다는 말, 나의 속도를 돌아보자는 말입니다.',
   '글씨를 따라 쓰다가 마음에 걸리는 단어가 있으면 바꾸어 보세요. 긍정은 정해진 문장을 믿는 시험이 아닙니다. 지금의 내가 받아들일 수 있는 말을 찾아가는 연습입니다.'
  ]:
   v=self.paragraph(44,v,paragraph,size=10.3,leading=18.9,width=333)+14
  self.done()
  # 04 how to
  self.base('이 책을 펼치는 법')
  self.heading(98,'사용 안내','읽고, 쓰고, 다시 고르기')
  entries=[('01','읽기','오늘의 문장과 짧은 이야기를 천천히 읽습니다. 지금 내 마음에 어떻게 들리는지 살펴봅니다.'),
           ('02','따라 쓰기','연한 글씨를 따라 쓴 뒤, 빈 줄에 한 번 더 적습니다. 글씨의 속도는 마음의 속도와 같지 않아도 됩니다.'),
           ('03','나의 말로 바꾸기','낯선 표현은 덜어내고, 오늘의 내가 받아들일 수 있는 말로 다시 적어봅니다.'),
           ('04','작은 행동 남기기','문장이 삶에 닿을 수 있도록 오늘 해볼 아주 작은 일을 한 가지 골라봅니다.')]
  y=202
  for num,head,body in entries:
   self.text(44,y,num,'SansBold',9,t['blue']);self.text(84,y,head,'SerifBold',14)
   y=self.paragraph(84,y+24,body,size=9.5,leading=16.3,width=286,color=t['muted'])+20
  self.done()
  # 05 check-in
  self.base('쓰기 전')
  self.heading(97,'시작하기','펜을 들기 전에')
  self.paragraph(44,193,'좋은 대답을 찾으려고 애쓰지 않아도 됩니다. 지금의 내 말투를 잠깐 들여다봅니다.',size=10.3,leading=20,width=330,color=t['muted'])
  for top,n,question in [(267,'01','요즘 나에게 가장 자주 하는 말은?'),(356,'02','그 말을 듣는 내 마음은 어떤가요?'),(446,'03','지금의 나에게 더 필요한 말은?')]:
   self.micro_label(top,n,question);self.ruled(top+30,n=2,spacing=28)
  self.done()
  # 06 contents
  self.base('14일의 문장')
  self.heading(96,'14 DAYS','내가 나에게 건네는 말들')
  self.paragraph(44,189,'순서대로 해도 좋고, 마음이 가는 날부터 펼쳐도 좋습니다.',size=9.5,leading=17,width=330,color=t['muted'])
  y=237
  for i,d in enumerate(DAYS):
   self.text(44,y,f'{i+1:02d}','SansBold',8.8,t['blue']);self.text(83,y,d['topic'],'Sans',10.2)
   self.text(A5W-44,y,f'{7+i*2:02d}','Sans',8.7,t['muted'],align='right')
   self.line(44,y+11,A5W-44,y+11,t['faint'],.28)
   y+=21.8
  self.done()

  for i,d in enumerate(DAYS):
   day=i+1
   # story page
   self.base(f'DAY {day:02d}  /  이야기')
   self.text(44,103,f'DAY {day:02d}     /     {d["topic"]}','SansBold',8.9,t['blue'])
   lines=self.split_text(d['title'],'SerifBold',20.0,333)
   yy=145
   for j,l in enumerate(lines):self.text(44,yy+29*j,l,'SerifBold',20)
   y=205+29*(len(lines)-1)
   self.line(44,y-16,107,y-16,t['blue'],.85)
   for p in d['paras']:
    y=self.paragraph(44,y+7,p,size=10.0,leading=18.2,width=332)+10
   # A voluntary everyday action suggestion, before the reflection question.
   self.text(44,400,'작은 시도  /  마음에 든다면','SansBold',8.3,t['blue'])
   self.paragraph(44,426,d['step'],size=9.2,leading=15.5,width=330,color=t['muted'])
   # reflection prompt along the bottom, without collision
   self.line(44,462,A5W-44,462,t['faint'],.6)
   self.text(44,485,'잠깐 생각해보기','SansBold',8.5,t['blue'])
   qend=self.paragraph(44,509,d['question'],size=9.2,leading=16,width=332)
   if qend > 547: raise RuntimeError(('story prompt overflows',day,qend))
   self.done()
   # copy page
   self.base(f'DAY {day:02d}  /  따라 쓰기')
   self.text(44,93,f'DAY {day:02d}     /     오늘의 문장','SansBold',8.8,t['blue'])
   title_lines=self.split_text(d['sentence'],'SerifBold',17.3,335)
   if len(title_lines)>2: raise RuntimeError(('large sentence overflows',day,title_lines))
   for j,l in enumerate(title_lines):self.text(44,126+24*j,l,'SerifBold',17.3)
   # separator always at fixed position
   self.line(44,168,A5W-44,168,t['faint'],.6)
   self.micro_label(190,'01','연한 문장을 따라 써보세요.')
   ghost_lines=self.split_text(d['sentence'],'Sans',14.6,332)
   if len(ghost_lines)>2:raise RuntimeError(('ghost sentence overflows',day,ghost_lines))
   if len(ghost_lines)==1: ghost_lines*=2
   for j,line in enumerate(ghost_lines):
    self.text(44,219+j*25,line,'Sans',14.6,t['ghost'])
    self.line(44,225+j*25,A5W-44,225+j*25,t['faint'],.55)
   self.micro_label(276,'02','문장을 가리고 다시 써보세요.')
   self.ruled(313,n=2,spacing=32)
   self.micro_label(373,'03','내 말로 조금 바꾸어 써보세요.')
   self.ruled(407,n=2,spacing=32)
   self.micro_label(465,'04','오늘 내가 해볼 작은 행동')
   self.ruled(500,n=1)
   self.done()

  # end section pages 35..40
  self.base('14일을 돌아보며')
  self.heading(96,'돌아보기','남은 것은 문장보다 나를 바라본 시간')
  self.paragraph(44,203,'모든 문장이 마음에 들지 않아도 됩니다. 하루 이틀 비어 있는 날이 있어도 괜찮습니다. 지금의 나와 가까워진 말을 한 번 돌아봅니다.',size=10.2,leading=19,width=332,color=t['muted'])
  for top,n,q in [(288,'01','가장 오래 마음에 남은 문장은?'),(378,'02','아직 내게 어색한 문장은?'),(468,'03','그 사이에서 발견한 나의 선택은?')]:
   self.micro_label(top,n,q);self.ruled(top+31,2,spacing=28)
  self.done()

  self.base('나의 문장')
  self.heading(100,'마지막 쓰기  /  1','나에게 건네는 한 문장')
  self.paragraph(44,205,'지금의 내가 받아들일 수 있는 크기로 한 문장을 골라봅니다. 남의 말을 빌려도 좋고, 오래 생각해 직접 만든 말이어도 좋습니다.',size=10.1,leading=19,width=331,color=t['muted'])
  self.micro_label(298,'01','나에게 남기고 싶은 한 문장')
  self.ruled(339,3,spacing=36)
  self.micro_label(458,'02','언제 이 문장을 다시 읽고 싶나요?')
  self.ruled(498,2,spacing=34)
  self.done()

  self.base('나의 문장')
  self.heading(100,'마지막 쓰기  /  2','내 말로 다시 써보기')
  self.paragraph(44,207,'“나는 반드시”라는 말이 부담스럽다면 “나는 조금씩”으로 바꾸어도 됩니다. 나에게 맞는 말은 언제든 새로 고를 수 있습니다.',size=10.1,leading=19,width=332,color=t['muted'])
  self.micro_label(305,'01','그 말을 내 목소리로 바꾸어 적으면?')
  self.ruled(350,4,spacing=37)
  self.text(44,521,'한 번에 다 쓰지 않아도 괜찮습니다.','Sans',8.2,t['muted'])
  self.done()

  self.base('다시 쓰는 빈 페이지')
  self.heading(94,'EXTRA  /  여백','필요할 때 다시 펼치는 페이지')
  self.paragraph(44,194,'오늘의 문장이나 새로 떠오른 말을 여기에 남겨보세요. 어떤 날에는 긴 말 대신 한 줄이면 충분할 수 있습니다.',size=10,leading=18,width=333,color=t['muted'])
  self.text(44,272,'오늘 나에게 필요한 말','SansBold',9,t['blue'])
  self.ruled(305,6,spacing=38)
  self.done()

  self.base('에필로그')
  self.heading(101,'에필로그','말이 먼저 닿지 않는 날에도')
  y=216
  for p in [
   '한 문장을 여러 번 쓴다고 마음이 갑자기 바뀌지는 않을 수 있습니다. 어떤 말은 오래 낯설고, 어떤 날에는 종이를 펼칠 힘조차 없을지도 모릅니다.',
   '그러나 펜을 잠시 멈추고 나의 목소리를 들어본 시간은 남습니다. 다그치던 말과 필요한 말을 구별하고, 어느 쪽을 선택할지 생각해 본 시간 말입니다.',
   '오늘 적은 말이 내일의 답일 필요는 없습니다. 내일의 나는 또 다른 문장을 고를 수 있습니다. 그 자유를 남겨두면 좋겠습니다.'
  ]:
   y=self.paragraph(44,y,p,size=10.25,leading=19.0,width=332)+20
  self.done()

  self.base('')
  self.text(44,105,'NAL MIND TOOLS','SansBold',9,t['blue'])
  self.text(44,165,'읽고 지나가지 않고,','SerifBold',19.5)
  self.text(44,199,'삶에 가져갈 수 있도록.','SerifBold',19.5)
  self.line(44,235,113,235,t['blue'],.9)
  y=self.paragraph(44,282,'NAL · 날빛은 책을 덮은 뒤에도 일상 속에서 꺼내 쓸 수 있는 작은 마음도구를 만듭니다.',size=10.4,leading=20,width=333)
  self.paragraph(44,y+16,'이 책을 모두 채우지 않아도 괜찮습니다. 필요한 날, 필요한 문장부터 다시 펼쳐보세요.',size=10.1,leading=19,width=331,color=t['muted'])
  self.line(44,420,A5W-44,420,t['faint'],.75)
  self.text(44,449,'긍정문장 따라 쓰기    /    14일 · 14개의 문장','SansBold',9,t['text'])
  self.paragraph(44,484,'이 자료는 자기성찰과 개인 기록을 돕는 무료 마음도구입니다. 심리평가·진단·치료를 대신하지 않습니다.',size=8.5,leading=15,width=334,color=t['muted'])
  self.text(44,541,'© 2026 NAL · 날빛','Sans',7.7,t['muted'])
  self.done(footer=False)
  self.c.save()
  assert self.page==40, self.page
  return self.path


def make_fillable(src,dest):
 doc=fitz.open(src)
 # Each 14-day writing page receives three easy-to-tap fields.
 # Top coordinates are A5 points; multi-line typing with PDF viewer.
 specs=[('recall',282,347),('own_words',383,445),('small_step',480,523)]
 for i in range(14):
  page=doc[7+i*2]
  for kind,y1,y2 in specs:
   w=fitz.Widget();w.rect=fitz.Rect(44,y1,375,y2)
   w.field_name=f'day_{i+1:02d}_{kind}'
   w.field_label={'recall':'문장 가리고 쓰기','own_words':'나의 문장','small_step':'오늘의 작은 행동'}[kind]
   w.field_type=fitz.PDF_WIDGET_TYPE_TEXT
   w.field_flags=4096
   w.text_fontsize=10.2
   w.border_width=0
   w.fill_color=None
   w.text_color=(0.17,0.23,0.32)
   w.field_value=''
   page.add_widget(w)
 # Front check-in pages, back reflection pages receive edit fields as well.
 extras={4:[('begin_often',286,329),('begin_feeling',374,414),('begin_needed',465,529)],
         34:[('end_remember',305,350),('end_difficult',397,436),('end_choice',482,530)],
         35:[('my_sentence',324,424),('reread',481,539)],
         36:[('my_voice',335,514)],37:[('free_write',286,509)]}
 for idx,rows in extras.items():
  page=doc[idx]
  for name,t1,t2 in rows:
   w=fitz.Widget();w.rect=fitz.Rect(44,t1,375,t2)
   w.field_name=name;w.field_type=fitz.PDF_WIDGET_TYPE_TEXT;w.field_flags=4096
   w.text_fontsize=10.2;w.border_width=0;w.fill_color=None;w.text_color=(0.17,0.23,0.32);w.field_value=''
   page.add_widget(w)
 doc.set_metadata({**doc.metadata,'title':'긍정문장 따라 쓰기 | 디지털 입력형 v2','author':'NAL · 날빛','subject':'14일 긍정문장 무료 마음도구 - 입력형'})
 doc.save(dest,garbage=4,deflate=True)
 return 42 + sum(len(x) for x in extras.values())

p_a5=OUT/'NAL_긍정문장_따라쓰기_v2_A5_소책자.pdf'
p_a4=OUT/'NAL_긍정문장_따라쓰기_v2_A4_흑백인쇄.pdf'
p_form=OUT/'NAL_긍정문장_따라쓰기_v2_디지털입력형.pdf'
p_cover=OUT/'NAL_긍정문장_따라쓰기_v2_스토어표지.png'
p_zip=OUT/'NAL_긍정문장_따라쓰기_v2_무료배포패키지.zip'
p_readme=OUT/'NAL_긍정문장_따라쓰기_v2_상품등록안내.txt'

Book(p_a5,A5,'color').build()
Book(p_a4,A4,'mono').build()
widget_count=make_fillable(p_a5,p_form)

# Crop-balanced storefront portrait PNG, consistent with PDF typography.
CW,CH=1200,1600
im=Image.new('RGB',(CW,CH),'#F8F7F3')
d=ImageDraw.Draw(im)
serif_reg='/usr/share/fonts/truetype/nanum/NanumMyeongjo.ttf'
serif_bold='/usr/share/fonts/truetype/nanum/NanumMyeongjoBold.ttf'
sans='/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf'
sans_b='/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf'
f=lambda path,size: ImageFont.truetype(path,size)
d.rectangle((0,0,CW,490),fill='#25314B')
d.text((116,116),'NAL  /  날빛 작은 책 04',font=f(sans_b,36),fill='#FCFCFC')
d.line((118,180,286,180),fill='#FCFCFC',width=3)
d.text((116,273),'읽고, 따라 쓰고,',font=f(serif_reg,56),fill='#FCFCFC')
d.text((116,351),'나의 말로 남기는 시간',font=f(serif_reg,56),fill='#FCFCFC')
d.text((116,693),'긍정문장',font=f(serif_bold,98),fill='#283146')
d.text((116,815),'따라 쓰기',font=f(serif_bold,98),fill='#283146')
d.text((118,950),'내게 건네는 14개의 문장',font=f(sans_b,42),fill='#496795')
d.line((118,1076,1082,1076),fill='#CDD4D9',width=3)
d.text((118,1160),'믿기 어려운 말 대신,',font=f(sans,36),fill='#6D7580')
d.text((118,1217),'오늘의 내가 적을 수 있는 말부터.',font=f(sans,36),fill='#6D7580')
d.text((118,1490),'FREE WORKBOOK   ·   14 DAYS',font=f(sans_b,31),fill='#496795')
im.save(p_cover,optimize=True)

readme='''NAL · 날빛 | 긍정문장 따라 쓰기 v2.0

[상품 등록 정보]
상품명: 긍정문장 따라 쓰기
분류: 무료 마음도구 / PDF 워크북
가격: 0원 (결제 없이 바로 다운로드)
형식: PDF
분량: 40쪽 / 14일 / 14개의 문장
다운로드 구성: A5 소책자, A4 흑백 인쇄판, PDF 디지털 입력형, 스토어 표지 PNG

[소개 문구]
긍정적인 말을 억지로 믿지 않아도 됩니다.
오늘의 나에게 조금 더 가까운 문장부터, 천천히 읽고 따라 써보세요.
14일 동안 문장을 읽고, 연한 글씨를 따라 쓰고, 내 말로 다시 적는 무료 워크북입니다.
작은 행동을 남기는 칸까지 마련했습니다.

[이용 안내]
A5 소책자: 태블릿 필기 앱 또는 A5 인쇄에 적합합니다.
A4 흑백 인쇄판: 가정·사무실 프린터에서 흑백으로 출력하기 편한 판입니다.
디지털 입력형: 키보드로 '다시 쓰기', '나의 문장', '작은 행동' 칸에 입력할 수 있도록 PDF 양식 필드를 포함했습니다. 한글 입력과 저장 동작은 사용하는 PDF 앱에 따라 다를 수 있으므로 Adobe Acrobat Reader 등 PDF 양식 지원 앱에서 확인하는 것을 권장합니다. 연한 글씨 따라 쓰기는 펜/스타일러스 또는 인쇄용으로 이용하세요.

[제작 품질 변경 기록]
- 맞춤법·어투 보완: DAY 03, 09, 10 문장 교정 및 본문 어조 정리
- 128×188mm에서 A5(148×210mm)로 확대
- 필기 간격 32pt 이상(A5 기준 약 11mm), A4판은 비례 확대
- 모든 DAY에 따라쓰기 / 가리고 쓰기 / 내 말 / 작은 행동 배치
- PDF 제목, 제작자, 설명, 검색 키워드 메타데이터 추가
- 40쪽 구성, 배포 전 편집 QA 대상

* 이 워크북은 자기성찰을 위한 도구로, 심리평가·진단·치료를 대신하지 않습니다.
* NAL 스토어 등록 및 배포 링크 연결은 아직 하지 않았습니다.
'''
p_readme.write_text(readme,encoding='utf-8')
with zipfile.ZipFile(p_zip,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
 for p in [p_a5,p_a4,p_form,p_cover,p_readme]:z.write(p,arcname=p.name)
print('BUILD DONE')
for p in [p_a5,p_a4,p_form,p_cover,p_readme,p_zip]:print(p.name,round(p.stat().st_size/1024),'KB')
print('Widgets',widget_count)
