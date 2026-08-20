// Catálogo inicial de constelaciones de Orbit.
const constellationDefs=[
 {id:'lyra',name:'Lira',need:8,desc:'Una primera señal de que algo nuevo empieza a dibujarse.',
  pts:[[50,18],[34,44],[50,63],[70,45],[50,18],[50,63]],edges:[[0,1],[1,2],[2,3],[3,0],[0,4]]},
 {id:'cassiopeia',name:'Casiopea',need:15,desc:'Cinco estrellas que recuerdan que también hay belleza en los cambios.',
  pts:[[18,48],[34,30],[50,52],[68,28],[84,47]],edges:[[0,1],[1,2],[2,3],[3,4]]},
 {id:'ursa-major',name:'Osa Mayor',need:30,desc:'Una constelación para orientarte cuando cuesta encontrar el norte.',
  pts:[[15,54],[31,46],[47,50],[60,39],[71,26],[83,31],[73,45]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]]},
 {id:'orion',name:'Orión',need:50,desc:'Fuerza, invierno y la certeza de que las noches también cambian.',
  pts:[[34,20],[66,22],[46,43],[52,44],[58,45],[36,72],[65,74]],edges:[[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]]},
 {id:'cygnus',name:'Cisne',need:80,desc:'Una cruz de estrellas que atraviesa el cielo como un camino.',
  pts:[[50,12],[50,35],[50,58],[50,83],[26,47],[76,47]],edges:[[0,1],[1,2],[2,3],[4,2],[2,5]]},
 {id:'andromeda',name:'Andrómeda',need:120,desc:'Una constelación que comparte nombre con una galaxia: todavía hay universo por delante.',
  pts:[[15,55],[31,46],[47,38],[61,31],[76,20],[58,54],[72,63]],edges:[[0,1],[1,2],[2,3],[3,4],[2,5],[5,6]]}
];

// Este archivo se ampliará con las constelaciones zodiacales y demás colecciones.
