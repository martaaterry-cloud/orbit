// Catálogo de plantillas de contenido de Orbit
// Base común con configuraciones por temática (sin modificar la interfaz visible actual)

const orbitTemplates = {
  ruptura: {
    id: 'ruptura',
    name: 'Volver a mí',
    home: {
      kicker: 'hoy',
      title: 'Un lugar para volver a ti',
      subtitle: 'Escribe, guarda pequeñas cosas y entra en las partes que necesites. No tienes que usarlo todo cada día.'
    },
    goals: [
      { id: 'msg', icon: 'chat', name: 'Su última conexión o si me ha escrito', sub: 'Elegir no abrir la conversación solo para buscar una señal' },
      { id: 'insta', icon: 'insta', name: 'Sus historias o seguidos en redes', sub: 'Elegir no mirar cambios de perfil para calmar la ansiedad' },
      { id: 'photos', icon: 'search', name: 'Fotos antiguas o conversaciones pasadas', sub: 'Elegir no revivir el pasado cuando siento nostalgia' },
      { id: 'friends', icon: 'chat', name: 'Preguntar a amigos comunes sobre cómo está', sub: 'Elegir cuidar mi espacio y no buscar información indirecta' }
    ],
    journalSections: [
      { id: 'libre', title: 'Entrada libre', prompt: '¿Qué quieres dejar aquí?', hint: 'No hace falta que tenga principio ni final.' },
      { id: 'no-enviado', title: 'Lo que no envié', prompt: 'Lo que no envié', hint: 'Puedes escribir exactamente lo que te saldría mandar.' },
      { id: 'futuro', title: 'Para mi yo futuro', prompt: 'Para mi yo futuro', hint: 'Desde quien eres hoy hacia una versión de ti que todavía no conoces.' },
      { id: 'aprendi', title: 'Lo que aprendí', prompt: 'Lo que aprendí', hint: 'Sobre lo que ahora sabes.' },
      { id: 'invisible', title: 'Lo invisible', prompt: 'Cómo se ve lo invisible', hint: 'Aquello que no puede tocarse, pero sigue teniendo peso.' }
    ],
    theme: {
      id: 'ruptura'
    }
  },
  autoestima: {
    id: 'autoestima',
    name: 'Conocerme y cuidarme',
    home: {
      kicker: 'hoy',
      title: 'Un espacio para cuidarte y conocerte',
      subtitle: 'Escucha lo que necesitas, reconoce tu valor y dale espacio a tu voz sin exigencias.'
    },
    goals: [
      { id: 'compare', icon: 'search', name: 'No compararme para sentir que valgo menos', sub: 'Detectar cuándo uso a otras personas como medida de mi propio valor' },
      { id: 'approval', icon: 'chat', name: 'No buscar validación constantemente', sub: 'Dar espacio a mi propia opinión antes de necesitar aprobación externa' },
      { id: 'self-talk', icon: 'activity', name: 'Cuidar cómo me hablo', sub: 'Detectar pensamientos duros y practicar una mirada más justa conmigo' },
      { id: 'boundaries', icon: 'search', name: 'Respetar mis límites', sub: 'Escuchar lo que necesito y practicar decir que no cuando corresponde' }
    ],
    journalSections: [
      { id: 'libre', title: 'Entrada libre', prompt: '¿Qué quieres dejar aquí?', hint: 'No hace falta que tenga principio ni final.' },
      { id: 'necesito', title: 'Qué necesito hoy', prompt: '¿Qué necesitas de ti hoy?', hint: 'Puede ser algo pequeño, concreto o simplemente descanso.' },
      { id: 'bien', title: 'Algo que hice bien', prompt: '¿Qué hiciste hoy que quieres reconocerte?', hint: 'No tiene que ser algo extraordinario.' },
      { id: 'aprendo', title: 'Lo que estoy aprendiendo de mí', prompt: '¿Qué has descubierto sobre ti?', hint: 'Una observación también cuenta.' },
      { id: 'futuro', title: 'Para mi yo futuro', prompt: '¿Qué quieres recordarle a tu yo futuro?', hint: 'Desde quien eres hoy hacia quien estás construyendo.' }
    ],
    theme: {
      id: 'autoestima'
    }
  }
};
