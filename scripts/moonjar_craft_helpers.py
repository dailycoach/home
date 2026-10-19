"""Shared, fixed QA poses. They are not a correct or recommended artwork."""
import math
from PIL import Image

def ids_for_count(n):
    if n==0:return []
    if n==1:return ['E01']
    groups='ABCDEFGH'; k=n//8
    return [f'{palette}{i:02d}' for i in range(1,k+1) for palette in groups]

def positions(ids,n):
    if n==0:return []
    if n==1:return [{'id':ids[0],'x':800,'y':925,'max_size':290,'angle':-11}]
    if n==8:
        coords=[(680,560),(1000,612),(1160,780),(1120,1120),(900,1370),(645,1280),(430,1060),(485,785)]
        return [{'id':item,'x':x,'y':y,'max_size':246,'angle':((i*23)%45)-22} for i,(item,(x,y)) in enumerate(zip(ids,coords))]
    nodes=[]
    for i,item in enumerate(ids):
        phi=i*math.pi*(3-math.sqrt(5))+.85
        r=math.sqrt((i+.7)/(n+1))
        jitter=math.sin(i*8.32)*12
        x=800+(550*r+jitter)*math.cos(phi)
        y=925+(555*r+jitter)*math.sin(phi)
        if i%17==14:
            x=780+660*math.cos(phi);y=925+665*math.sin(phi)
        nodes.append({'id':item,'x':round(x,1),'y':round(y,1),
                     'max_size':202 if n==48 else 159,'angle':round((i*19)%68-34,1)})
    return nodes

def prepare_node(source,max_size,angle):
    im=source.copy();im.thumbnail((max_size,max_size),Image.Resampling.LANCZOS)
    if angle:im=im.rotate(-angle,Image.Resampling.BICUBIC,expand=True)
    return im