# -*- coding: utf-8 -*-
"""NAL free positive-writing 02 · v2.1 editorial storefront asset generator.
Uses the existing proven 40-page PDF generator while substituting the
fully revised second-volume manuscript and relationship-specific design.
Never edits the published first-volume binaries or commerce implementation.
"""
import base64, json, re, shutil, zlib
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DAYS = json.loads(zlib.decompress(base64.b64decode("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")))
assert len(DAYS) == 14 and all(len(d["paras"]) == 3 for d in DAYS)
original = REPO / "scripts/generate-nal-positive-writing-v2.py"
code = original.read_text(encoding="utf-8")
def change(needle, replacement):
    global code
    assert needle in code, f"Missing expected first-volume generator anchor: {needle[:90]}"
    code = code.replace(needle, replacement)

start=code.index("DAYS=[")
end=code.index("assert len(DAYS)==14", start)
code=code[:start]+"DAYS="+repr(DAYS)+"\n"+code[end:]
change("'.nal-positive-writing-generated'", "'.nal-positive-writing-02-generated'")
for old,new in [
    ("#F8F7F3","#FAF7F4"),("#283146","#352B35"),("#496795","#755773"),
    ("#6D7580","#7E727B"),("#25314B","#4E394D"),("#B4BCC4","#BFAFB9"),
    ("#D9DDE1","#DCD1D7"),
    ("FREE MIND TOOL 04","FREE MIND TOOL 05"),
    ("날빛 작은 책 04","날빛 작은 책 05"),
    ("긍정문장 따라 쓰기 | NAL · 날빛 무료 마음도구 v2","긍정문장 따라 쓰기 02 | NAL · 날빛 무료 마음도구 v2.1"),
    ("내게 건네는 14개의 문장","관계 속에서도 나를 잃지 않는 말"),
    ("믿기 어려운 말 대신,","서로를 이해하려 애쓰는 동안,"),
    ("오늘의 내가 적을 수 있는 말부터.","나의 목소리도 놓치지 않도록."),
    ("괜찮아지라는 말보다,","서로를 이해하려는 마음만큼,"),
    ("나를 지나치지 않는 말.","내 목소리도 잊지 않는 말."),
    ("나를 믿게 되는 말에는 각자의 속도가 있습니다.","관계 안에서도 내 목소리는 소중합니다."),
    ("내가 나에게 건네는 말들","관계 속에서 나에게 건네는 말들"),
]:
    code = code.replace(old,new)

preface=[
 "답장을 기다리다가 휴대전화를 다시 켜는 밤이 있습니다. 어쩐지 나만 노력하는 것 같고, 잘 지내고 싶은 마음 때문에 정작 내 말은 뒤로 미룹니다.",
 "사람과 가까이 지내는 것과 나를 지키는 일은 반드시 반대편에 있지 않습니다. 모르는 마음은 확인하고, 서운함은 천천히 듣고, 필요하다면 정중하게 거절할 수 있습니다.",
 "이 책은 누군가를 설득하거나 모든 관계를 회복하게 하려는 책이 아닙니다. 하루에 한 문장씩, 관계 속에서도 내가 고를 수 있는 말과 작은 행동을 연습합니다."
]
code,n=re.subn(r"(  # 03 preface\n.*?\n  v=232\n)  for paragraph in \[.*?\n  \]:",lambda m:m.group(1)+"  for paragraph in "+repr(preface)+":",code,count=1,flags=re.S)
assert n==1,"preface substitution failed"

# Present a writable scene memo beneath the original three-paragraph essay.
pattern=r"   # A voluntary everyday action suggestion, before the reflection question\.[\s\S]*?   self.done\(\)\n   # copy page"
replacement="""   self.line(44,404,A5W-44,404,t['faint'],.6)
   self.text(44,429,'그날의 장면 메모','SansBold',8.5,t['blue'])
   end=self.paragraph(44,453,d['scene_memo_question'],size=9.2,leading=16,width=330)
   if end>494: raise RuntimeError(('scene question overflows',day,end))
   self.ruled(513,n=1)
   self.done()
   # copy page"""
code,n=re.subn(pattern,lambda m:replacement,code,count=1)
assert n==1,"story memo substitution failed"

# Keep the existing handwriting lines, but make today's self-dialogue question specific.
change("   self.micro_label(373,'03','내 말로 조금 바꾸어 써보세요.')",
       "   self.micro_label(373,'03','오늘 나에게 건넬 말')\n   self.paragraph(44,392,d['own_voice_prompt'],size=8.5,leading=13.5,width=332,color=t['muted'])")
change("   self.ruled(407,n=2,spacing=32)","   self.ruled(425,n=2,spacing=26)")
change("   self.micro_label(465,'04','오늘 내가 해볼 작은 행동')",
       "   self.micro_label(474,'04','오늘 내가 해볼 작은 행동')")
change("   self.ruled(500,n=1)",
       "   self.paragraph(44,492,d['step'],size=7.7,leading=12,width=330,color=t['muted'])\n   self.ruled(522,n=1)")

# A5 keyboard edition: preserve the day writing widgets and add a story-memo field.
change("specs=[('recall',282,347),('own_words',383,445),('small_step',480,523)]",
       "specs=[('recall',282,347),('own_words',407,464),('small_step',509,537)]")
change("   page.add_widget(w)\n # Front check-in pages",
       "   page.add_widget(w)\n  story=doc[6+i*2]\n  memo=fitz.Widget();memo.rect=fitz.Rect(44,491,375,540)\n  memo.field_name=f'day_{i+1:02d}_scene_memo'\n  memo.field_label='그날의 장면 메모'\n  memo.field_type=fitz.PDF_WIDGET_TYPE_TEXT;memo.field_flags=4096\n  memo.text_fontsize=9.2;memo.border_width=0;memo.fill_color=None;memo.text_color=(0.22,0.17,0.23);memo.field_value=''\n  story.add_widget(memo)\n # Front check-in pages")
change("return 42 + sum(len(x) for x in extras.values())",
       "return 56 + sum(len(x) for x in extras.values())")
change("긍정문장 따라 쓰기 | 디지털 입력형 v2","긍정문장 따라 쓰기 02 | 디지털 입력형 v2.1")
# A storefront-safe subtitle replacing the too wide first-volume single-line cover text.
change("d.text((118,950),'관계 속에서도 나를 잃지 않는 말',font=f(sans_b,42)",
       "d.text((118,950),'관계 속에서도 나를 잃지 않는 말',font=f(sans_b,34)")

# Do not expose misleading first-volume boilerplate in the second release package.
scope={"__file__":str(original),"__name__":"__main__"}
exec(compile(code,str(original),"exec"),scope)
generated=REPO/".nal-positive-writing-02-generated"
mapping={
 "NAL_긍정문장_따라쓰기_v2_A5_소책자.pdf":"nal/assets/downloads/free/nal-positive-writing-02-relationships-v21-a5.pdf",
 "NAL_긍정문장_따라쓰기_v2_A4_흑백인쇄.pdf":"nal/assets/downloads/free/nal-positive-writing-02-relationships-v21-a4-print.pdf",
 "NAL_긍정문장_따라쓰기_v2_디지털입력형.pdf":"nal/assets/downloads/free/nal-positive-writing-02-relationships-v21-fillable.pdf",
 "NAL_긍정문장_따라쓰기_v2_스토어표지.png":"nal/assets/images/catalog/shop/retail/nal-positive-writing-02-relationships-v21-cover.png"
}
for src,dst in mapping.items():
    infile=generated/src
    outfile=REPO/dst
    assert infile.is_file(),src
    outfile.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(infile,outfile)
    print("ASSET",dst,outfile.stat().st_size)
import fitz
for filepath in list(mapping.values())[:3]:
    d=fitz.open(REPO/filepath)
    assert len(d)==40,(filepath,len(d))
    text='\n'.join(p.get_text() for p in d)
    for day in DAYS:
        assert day["sentence"] in text,(filepath,day["sentence"])
    print("VALIDATED",filepath,len(d))
print("SECOND VOLUME COMPLETED")
