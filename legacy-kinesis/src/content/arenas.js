const D='Drifter',S='Spitter',L='Looper',W='Warden';
const SPAWN_GAP=150;
function wave(kinds,angles,distance=280) {
  return kinds.map((archetype,i)=>({id:'spawn-'+i,archetype,
    angle:angles[i%angles.length]*Math.PI/180,distance,delay:i*SPAWN_GAP,
    phase:i*.7,speed:archetype===D?24:0}));
}
export const ARENAS=[
  {id:'kerning',name:'Kerning Courtyard',subtitle:'Learn what your shelter can become',waves:[
    wave([D,D],[-145,35]),
    wave([D,L,D],[-135,0,135]),
    wave([D,S,L],[-150,-30,70]),
    wave([D,W],[-140,35])
  ]},
  {id:'rooftop',name:'Rooftop Junction',subtitle:'Crossed lanes above the city',waves:[
    wave([D,S],[-155,30]),
    wave([D,L,S],[-140,0,130],300),
    wave([S,D,L],[-160,-20,160],300),
    wave([D,W,S],[-140,30,100],300)
  ]},
  {id:'observatory',name:'Psychic Observatory',subtitle:'Keep a gap open. Choose when it is safe.',waves:[
    wave([D,S],[-150,30],305),
    wave([S,L,D],[-140,0,120],305),
    wave([D,S,L],[-160,-20,150],305),
    wave([D,W,S],[-140,30,100],305)
  ]}
];
