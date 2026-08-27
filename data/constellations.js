// ============================================================================
// Catálogo de Constelaciones de Orbit (v1.3.1)
// ----------------------------------------------------------------------------
// Arquitectura de datos para cartografía celeste y futuro agente de generación.
//
// Separación conceptual:
// 1. GEOMETRÍA CELESTE:
//    - stars: [{ id, x, y, name?, mag? }] (coordenadas porcentuales [0, 100])
//    - edges: [['starA', 'starB'], ...] (aristas semánticas entre IDs de estrellas)
// 2. ECONOMÍA Y PROGRESIÓN ORBIT:
//    - need: Estrellas históricas de vida requeridas para descubrir
//    - cost: Estrellas de cesta para iluminar en el firmamento personal
//    - collection: Región celeste ('norte', 'zodiaco', 'invierno', 'profundo')
// 3. LAYOUT DEL UNIVERSO:
//    - x, y: Coordenadas porcentuales en el mapa del cielo [10 - 90]
//    - size: Tamaño base en píxeles del cuadrante
//    - rot: Rotación escénica en grados
// ============================================================================

const rawConstellationCatalog = [
  // --------------------------------------------------------------------------
  // I. PRIMER CIELO (Colección: norte / cielo-1)
  // --------------------------------------------------------------------------

  // PILOTO 1: Lira (Lyra) - Vega destacada y cuerpo de lira en paralelogramo
  {
    id: 'lyra',
    name: 'Lira',
    collection: 'norte',
    stars: [
      { id: 'vega', x: 26, y: 18, name: 'Vega' },
      { id: 'sheliak', x: 44, y: 32, name: 'Sheliak' },
      { id: 'sulafat', x: 38, y: 76, name: 'Sulafat' },
      { id: 'delta_lyr', x: 74, y: 42, name: 'Delta Lyrae' },
      { id: 'gamma_lyr', x: 68, y: 84, name: 'Gamma Lyrae' }
    ],
    edges: [
      ['vega', 'sheliak'],
      ['sheliak', 'delta_lyr'],
      ['delta_lyr', 'gamma_lyr'],
      ['gamma_lyr', 'sulafat'],
      ['sulafat', 'sheliak']
    ],
    need: 8,
    cost: 1,
    desc: 'Una primera señal de que algo nuevo empieza a dibujarse.',
    myth: 'El instrumento celestial de Orfeo, cuya música serenaba incluso a las fieras.',
    x: 75,
    y: 24,
    size: 110,
    rot: -5
  },

  // PILOTO 2: Casiopea (Cassiopeia) - La icónica "W" de 5 estrellas
  {
    id: 'cassiopeia',
    name: 'Casiopea',
    collection: 'norte',
    stars: [
      { id: 'caph', x: 16, y: 44, name: 'Caph' },
      { id: 'schedar', x: 34, y: 64, name: 'Schedar' },
      { id: 'gamma_cas', x: 50, y: 36, name: 'Navi' },
      { id: 'ruchbah', x: 68, y: 62, name: 'Ruchbah' },
      { id: 'segin', x: 84, y: 42, name: 'Segin' }
    ],
    edges: [
      ['caph', 'schedar'],
      ['schedar', 'gamma_cas'],
      ['gamma_cas', 'ruchbah'],
      ['ruchbah', 'segin']
    ],
    need: 15,
    cost: 1,
    desc: 'Cinco estrellas que recuerdan que también hay belleza en los cambios.',
    myth: 'La reina etíope sentada en su trono celestial, girando eterna cerca de la Estrella Polar.',
    x: 25,
    y: 64,
    size: 120,
    rot: -45
  },

  // PILOTO 3: Osa Mayor (Ursa Major) - El Carro / Septentrión (3 en mango, 4 en cazo)
  {
    id: 'ursa-major',
    name: 'Osa Mayor',
    collection: 'norte',
    stars: [
      { id: 'alkaid', x: 14, y: 68, name: 'Alkaid' },
      { id: 'mizar', x: 28, y: 56, name: 'Mizar' },
      { id: 'alioth', x: 44, y: 52, name: 'Alioth' },
      { id: 'megrez', x: 58, y: 52, name: 'Megrez' },
      { id: 'phecda', x: 58, y: 78, name: 'Phecda' },
      { id: 'merak', x: 82, y: 74, name: 'Merak' },
      { id: 'dubhe', x: 82, y: 46, name: 'Dubhe' }
    ],
    edges: [
      ['alkaid', 'mizar'],
      ['mizar', 'alioth'],
      ['alioth', 'megrez'],
      ['megrez', 'phecda'],
      ['phecda', 'merak'],
      ['merak', 'dubhe'],
      ['dubhe', 'megrez']
    ],
    need: 30,
    cost: 1,
    desc: 'Una constelación para orientarte cuando cuesta encontrar el norte.',
    myth: 'El gran carro cósmico que ha guiado a navegantes y viajeros a lo largo de los siglos.',
    x: 75,
    y: 64,
    size: 135,
    rot: -5
  },

  // PILOTO 4: Cisne (Cygnus) - La Cruz del Norte limpia y simétrica
  {
    id: 'cygnus',
    name: 'Cisne',
    collection: 'norte',
    stars: [
      { id: 'deneb', x: 50, y: 14, name: 'Deneb' },
      { id: 'sadr', x: 50, y: 46, name: 'Sadr' },
      { id: 'albireo', x: 50, y: 84, name: 'Albireo' },
      { id: 'gienah', x: 20, y: 46, name: 'Gienah' },
      { id: 'delta_cyg', x: 80, y: 46, name: 'Delta Cygni' }
    ],
    edges: [
      ['deneb', 'sadr'],
      ['sadr', 'albireo'],
      ['gienah', 'sadr'],
      ['sadr', 'delta_cyg']
    ],
    need: 80,
    cost: 1,
    desc: 'Una cruz de estrellas que atraviesa el cielo como un camino.',
    myth: 'El cisne que surca la Vía Láctea desplegando sus amplias alas de plata sobre el cielo nocturno.',
    x: 25,
    y: 24,
    size: 125,
    rot: 25
  },

  // --------------------------------------------------------------------------
  // II. ZODIACO (Colección: zodiaco)
  // --------------------------------------------------------------------------
  {
    id: 'aries',
    name: 'Aries',
    collection: 'zodiaco',
    stars: [
      { id: 'a1', x: 30, y: 60, name: 'Hamal' },
      { id: 'a2', x: 45, y: 55, name: 'Sheratan' },
      { id: 'a3', x: 65, y: 40, name: 'Mesarthim' },
      { id: 'a4', x: 75, y: 25 }
    ],
    edges: [
      ['a1', 'a2'],
      ['a2', 'a3'],
      ['a3', 'a4']
    ],
    need: 20,
    cost: 1,
    desc: 'El carnero, símbolo de inicios y energía incipiente.',
    myth: 'El vellocino de oro que representa el coraje de dar el primer paso.',
    x: 50,
    y: 14,
    size: 85,
    rot: 10
  },
  {
    id: 'taurus',
    name: 'Tauro',
    collection: 'zodiaco',
    stars: [
      { id: 't1', x: 20, y: 20, name: 'Elnath' },
      { id: 't2', x: 40, y: 35, name: 'Tianguan' },
      { id: 't3', x: 60, y: 35, name: 'Aldebaran' },
      { id: 't4', x: 80, y: 20 },
      { id: 't5', x: 60, y: 55, name: 'Hyades' },
      { id: 't6', x: 40, y: 65 }
    ],
    edges: [
      ['t1', 't2'],
      ['t2', 't3'],
      ['t3', 't4'],
      ['t3', 't5'],
      ['t5', 't6']
    ],
    need: 35,
    cost: 1,
    desc: 'El toro, constelación que evoca estabilidad, fuerza y paciencia.',
    myth: 'La mirada ardiente del toro coronada por el cúmulo de las Híades y las Pléyades.',
    x: 70,
    y: 19,
    size: 85,
    rot: 0
  },
  {
    id: 'gemini',
    name: 'Géminis',
    collection: 'zodiaco',
    stars: [
      { id: 'g1', x: 30, y: 20, name: 'Castor' },
      { id: 'g2', x: 70, y: 20, name: 'Pollux' },
      { id: 'g3', x: 30, y: 70, name: 'Alhena' },
      { id: 'g4', x: 70, y: 70, name: 'Wasat' },
      { id: 'g5', x: 30, y: 45, name: 'Mebsuta' },
      { id: 'g6', x: 70, y: 45, name: 'Mekbuda' }
    ],
    edges: [
      ['g1', 'g2'],
      ['g1', 'g3'],
      ['g2', 'g4'],
      ['g5', 'g6']
    ],
    need: 50,
    cost: 1,
    desc: 'Los gemelos, que representan la dualidad, el diálogo y el aprendizaje.',
    myth: 'Cástor y Pólux, hermanos inseparables unidos en la bóveda celeste.',
    x: 84,
    y: 31,
    size: 85,
    rot: 10
  },
  {
    id: 'cancer',
    name: 'Cáncer',
    collection: 'zodiaco',
    stars: [
      { id: 'c1', x: 50, y: 20, name: 'Tegmine' },
      { id: 'c2', x: 50, y: 45, name: 'Asellus' },
      { id: 'c3', x: 30, y: 70, name: 'Acubens' },
      { id: 'c4', x: 70, y: 70, name: 'Altarf' }
    ],
    edges: [
      ['c1', 'c2'],
      ['c2', 'c3'],
      ['c2', 'c4']
    ],
    need: 65,
    cost: 1,
    desc: 'El cangrejo, símbolo de protección, hogar y el mundo emocional.',
    myth: 'Guardián del cúmulo del Pesebre en el corazón del cielo nocturno.',
    x: 86,
    y: 47,
    size: 85,
    rot: -15
  },
  {
    id: 'leo',
    name: 'Leo',
    collection: 'zodiaco',
    stars: [
      { id: 'l1', x: 30, y: 60, name: 'Denebola' },
      { id: 'l2', x: 50, y: 60, name: 'Zosma' },
      { id: 'l3', x: 70, y: 45, name: 'Regulus' },
      { id: 'l4', x: 70, y: 25, name: 'Algieba' },
      { id: 'l5', x: 55, y: 20, name: 'Adhafera' },
      { id: 'l6', x: 40, y: 25, name: 'Rasalas' },
      { id: 'l7', x: 40, y: 40 },
      { id: 'l8', x: 55, y: 40 }
    ],
    edges: [
      ['l1', 'l2'],
      ['l2', 'l3'],
      ['l3', 'l4'],
      ['l4', 'l5'],
      ['l5', 'l6'],
      ['l6', 'l7'],
      ['l7', 'l8']
    ],
    need: 80,
    cost: 1,
    desc: 'El león, constelación que brilla con fuerza propia y expresión vital.',
    myth: 'El león de Nemea, cuya luz noble preside la primavera.',
    x: 82,
    y: 63,
    size: 85,
    rot: 5
  },
  {
    id: 'virgo',
    name: 'Virgo',
    collection: 'zodiaco',
    stars: [
      { id: 'v1', x: 25, y: 25, name: 'Vindemiatrix' },
      { id: 'v2', x: 45, y: 35, name: 'Porrima' },
      { id: 'v3', x: 65, y: 25, name: 'Zavijava' },
      { id: 'v4', x: 55, y: 55, name: 'Spica' },
      { id: 'v5', x: 35, y: 65, name: 'Heze' },
      { id: 'v6', x: 75, y: 65, name: 'Syrma' }
    ],
    edges: [
      ['v1', 'v2'],
      ['v2', 'v3'],
      ['v2', 'v4'],
      ['v4', 'v5'],
      ['v4', 'v6']
    ],
    need: 95,
    cost: 1,
    desc: 'La virgen, que representa el análisis, la curación y la atención al detalle.',
    myth: 'Astrea portando la espiga de trigo Spica como símbolo de cosecha y serenidad.',
    x: 68,
    y: 76,
    size: 85,
    rot: -10
  },
  {
    id: 'libra',
    name: 'Libra',
    collection: 'zodiaco',
    stars: [
      { id: 'li1', x: 50, y: 20, name: 'Zubeneschamali' },
      { id: 'li2', x: 30, y: 50, name: 'Zubenelgenubi' },
      { id: 'li3', x: 70, y: 50, name: 'Zubenelakrab' },
      { id: 'li4', x: 50, y: 80, name: 'Brachium' }
    ],
    edges: [
      ['li1', 'li2'],
      ['li1', 'li3'],
      ['li2', 'li4'],
      ['li3', 'li4']
    ],
    need: 110,
    cost: 1,
    desc: 'La balanza, símbolo de equilibrio, relaciones y justicia interior.',
    myth: 'Los platillos celestes que miden la armonía y la verdad.',
    x: 50,
    y: 80,
    size: 85,
    rot: 15
  },
  {
    id: 'scorpio',
    name: 'Escorpio',
    collection: 'zodiaco',
    stars: [
      { id: 'sc1', x: 30, y: 20, name: 'Graffias' },
      { id: 'sc2', x: 50, y: 25, name: 'Dschubba' },
      { id: 'sc3', x: 60, y: 40, name: 'Antares' },
      { id: 'sc4', x: 55, y: 60, name: 'Larawag' },
      { id: 'sc5', x: 45, y: 80, name: 'Shaula' },
      { id: 'sc6', x: 30, y: 75, name: 'Lesath' }
    ],
    edges: [
      ['sc1', 'sc2'],
      ['sc2', 'sc3'],
      ['sc3', 'sc4'],
      ['sc4', 'sc5'],
      ['sc5', 'sc6']
    ],
    need: 125,
    cost: 1,
    desc: 'El escorpión, representante de la transformación profunda y la intensidad.',
    myth: 'El corazón ardiente de Antares que vigila la noche estival.',
    x: 32,
    y: 76,
    size: 85,
    rot: -5
  },
  {
    id: 'sagittarius',
    name: 'Sagitario',
    collection: 'zodiaco',
    stars: [
      { id: 'sg1', x: 30, y: 50, name: 'Kaus Australis' },
      { id: 'sg2', x: 50, y: 35, name: 'Kaus Media' },
      { id: 'sg3', x: 70, y: 50, name: 'Nunki' },
      { id: 'sg4', x: 50, y: 65, name: 'Ascella' },
      { id: 'sg5', x: 70, y: 30, name: 'Kaus Borealis' },
      { id: 'sg6', x: 85, y: 50, name: 'Alnasl' },
      { id: 'sg7', x: 70, y: 70, name: 'Rukbat' }
    ],
    edges: [
      ['sg1', 'sg2'],
      ['sg2', 'sg3'],
      ['sg3', 'sg4'],
      ['sg4', 'sg1'],
      ['sg3', 'sg5'],
      ['sg3', 'sg6'],
      ['sg3', 'sg7']
    ],
    need: 140,
    cost: 1,
    extra: 'tu signo',
    desc: 'El arquero, símbolo de búsqueda, sentido, libertad y tu propio signo solar.',
    myth: 'La flecha orientada directamente hacia el centro galáctico de la Vía Láctea.',
    x: 18,
    y: 63,
    size: 85,
    rot: 20
  },
  {
    id: 'capricorn',
    name: 'Capricornio',
    collection: 'zodiaco',
    stars: [
      { id: 'cp1', x: 20, y: 30, name: 'Algedi' },
      { id: 'cp2', x: 40, y: 55, name: 'Dabih' },
      { id: 'cp3', x: 70, y: 60, name: 'Deneb Algedi' },
      { id: 'cp4', x: 80, y: 35, name: 'Nashira' },
      { id: 'cp5', x: 55, y: 30 }
    ],
    edges: [
      ['cp1', 'cp2'],
      ['cp2', 'cp3'],
      ['cp3', 'cp4'],
      ['cp4', 'cp5'],
      ['cp5', 'cp1']
    ],
    need: 155,
    cost: 1,
    desc: 'La cabra marina, símbolo de perseverancia, raíces y metas a largo plazo.',
    myth: 'Criatura ancestral que asciende desde las aguas profundas a las cumbres más altas.',
    x: 14,
    y: 47,
    size: 85,
    rot: 10
  },
  {
    id: 'aquarius',
    name: 'Acuario',
    collection: 'zodiaco',
    stars: [
      { id: 'aq1', x: 25, y: 30, name: 'Sadalmelik' },
      { id: 'aq2', x: 45, y: 35, name: 'Sadalsuud' },
      { id: 'aq3', x: 50, y: 55, name: 'Sadaltager' },
      { id: 'aq4', x: 70, y: 45, name: 'Skat' },
      { id: 'aq5', x: 80, y: 65, name: 'Albali' }
    ],
    edges: [
      ['aq1', 'aq2'],
      ['aq2', 'aq3'],
      ['aq3', 'aq4'],
      ['aq4', 'aq5']
    ],
    need: 170,
    cost: 1,
    desc: 'El aguador, símbolo de innovación, comunidad y renovación mental.',
    myth: 'El vertedor de las corrientes de agua viva sobre el cielo estrellado.',
    x: 16,
    y: 31,
    size: 85,
    rot: -15
  },
  {
    id: 'pisces',
    name: 'Piscis',
    collection: 'zodiaco',
    stars: [
      { id: 'pi1', x: 20, y: 20, name: 'Alrescha' },
      { id: 'pi2', x: 40, y: 35, name: 'Fumalsamakah' },
      { id: 'pi3', x: 60, y: 40, name: 'Torcular' },
      { id: 'pi4', x: 80, y: 55, name: 'Kullat Nunu' },
      { id: 'pi5', x: 65, y: 75 },
      { id: 'pi6', x: 45, y: 70 }
    ],
    edges: [
      ['pi1', 'pi2'],
      ['pi2', 'pi3'],
      ['pi3', 'pi4'],
      ['pi4', 'pi5'],
      ['pi5', 'pi6']
    ],
    need: 185,
    cost: 1,
    desc: 'Los peces, símbolo de intuición, disolución y empatía cósmica.',
    myth: 'Dos seres unidos por un cordón celeste nadando en direcciones complementarias.',
    x: 30,
    y: 19,
    size: 85,
    rot: 25
  },

  // --------------------------------------------------------------------------
  // III. CIELO DE INVIERNO (Colección: invierno / orion)
  // --------------------------------------------------------------------------

  // PILOTO 5: Orión (Orion) - Reloj de arena, hombros, cinturón y pies limpios
  {
    id: 'orion',
    name: 'Orión',
    collection: 'invierno',
    stars: [
      { id: 'betelgeuse', x: 30, y: 20, name: 'Betelgeuse' },
      { id: 'bellatrix', x: 70, y: 22, name: 'Bellatrix' },
      { id: 'mintaka', x: 40, y: 49, name: 'Mintaka' },
      { id: 'alnilam', x: 50, y: 50, name: 'Alnilam' },
      { id: 'alnitak', x: 60, y: 51, name: 'Alnitak' },
      { id: 'saiph', x: 34, y: 80, name: 'Saiph' },
      { id: 'rigel', x: 68, y: 78, name: 'Rigel' }
    ],
    edges: [
      ['betelgeuse', 'bellatrix'],
      ['betelgeuse', 'mintaka'],
      ['bellatrix', 'alnitak'],
      ['mintaka', 'alnilam'],
      ['alnilam', 'alnitak'],
      ['mintaka', 'saiph'],
      ['alnitak', 'rigel'],
      ['saiph', 'rigel']
    ],
    need: 60,
    cost: 1,
    desc: 'Fuerza, invierno y la certeza de que las noches también cambian.',
    myth: 'El cazador titánico que preside los cielos invernales con su cinturón inconfundible.',
    x: 50,
    y: 44,
    size: 145,
    rot: -10
  },

  // --------------------------------------------------------------------------
  // IV. ESPACIO PROFUNDO (Colección: profundo)
  // --------------------------------------------------------------------------
  {
    id: 'andromeda',
    name: 'Andrómeda',
    collection: 'profundo',
    stars: [
      { id: 'alpheratz', x: 15, y: 55, name: 'Alpheratz' },
      { id: 'delta_and', x: 31, y: 46, name: 'Delta Andromedae' },
      { id: 'mirach', x: 47, y: 38, name: 'Mirach' },
      { id: 'mu_and', x: 61, y: 31, name: 'Mu Andromedae' },
      { id: 'almach', x: 76, y: 20, name: 'Almach' },
      { id: 'm31_gal', x: 58, y: 54, name: 'M31' },
      { id: 'upsilon_and', x: 72, y: 63, name: 'Upsilon Andromedae' }
    ],
    edges: [
      ['alpheratz', 'delta_and'],
      ['delta_and', 'mirach'],
      ['mirach', 'mu_and'],
      ['mu_and', 'almach'],
      ['mirach', 'm31_gal'],
      ['m31_gal', 'upsilon_and']
    ],
    need: 120,
    cost: 1,
    desc: 'Una constelación que comparte nombre con una galaxia: todavía hay universo por delante.',
    myth: 'La princesa encadenada a las estrellas cuyo brazo señala el espiral de la galaxia vecina.',
    x: 50,
    y: 44,
    size: 145,
    rot: 15
  }
];

// Normalización automática para garantizar compatibilidad completa con el motor y render
const constellationDefs = (function() {
  if (typeof ConstellationUtils !== 'undefined' && ConstellationUtils.normalizeConstellation) {
    return rawConstellationCatalog.map(ConstellationUtils.normalizeConstellation);
  }
  // Fallback directo por si se carga antes del módulo de utilidades
  return rawConstellationCatalog.map(c => {
    const starMap = {};
    const stars = (c.stars || []).map((s, idx) => {
      const id = s.id || `s${idx}`;
      starMap[id] = idx;
      starMap[idx] = idx;
      return { id, x: s.x !== undefined ? s.x : s[0], y: s.y !== undefined ? s.y : s[1], name: s.name };
    });
    const pts = stars.map(s => [s.x, s.y]);
    const edges = (c.edges || []).map(([a, b]) => {
      const idxA = typeof a === 'number' ? a : starMap[a];
      const idxB = typeof b === 'number' ? b : starMap[b];
      return [idxA !== undefined ? idxA : 0, idxB !== undefined ? idxB : 0];
    });
    return { ...c, stars, pts, edges };
  });
})();

// Exportación para Node.js y navegador
if (typeof module === 'object' && module.exports) {
  module.exports = {
    rawConstellationCatalog,
    constellationDefs
  };
}
