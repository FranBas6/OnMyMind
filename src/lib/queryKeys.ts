/**
 * Claves de TanStack Query (documento 04 §Estado y datos). Todas salen de aquí para que
 * leer, invalidar y actualizar la caché use siempre la misma forma de clave.
 *
 * Son jerárquicas: `invalidateQueries({ queryKey: queryKeys.lists.all })` invalida también
 * `queryKeys.lists.detail(id)`, porque la clave de detalle empieza por `['lists']`.
 */
export const queryKeys = {
  lists: {
    all: ['lists'] as const,
    /** Archivadas: cuelga de `['lists']`, así que invalidar `all` también las refresca. */
    archived: ['lists', 'archived'] as const,
    detail: (listId: string) => ['lists', listId] as const,
  },
  items: {
    byList: (listId: string) => ['items', { listId }] as const,
    /** Últimas capturas pendientes de una lista (la tarjeta de «En mente» en escritorio). */
    latest: (listId: string, limit: number) => ['items', { listId, latest: limit }] as const,
    /**
     * Hoy, con el día en la clave (`2026-09-28`): a medianoche es otra consulta y no se reutiliza
     * la de ayer. `todayAll` las abarca todas, para que las mutaciones de ítems las actualicen.
     */
    todayAll: ['items', 'today'] as const,
    today: (day: string) => ['items', 'today', day] as const,
    /**
     * Otro día en Hoy (2.5): lo de la rejilla de un mes (`2026-10`), para el día y los puntos del
     * calendario. `daysAll` las abarca todas, como `todayAll`.
     */
    daysAll: ['items', 'days'] as const,
    days: (month: string) => ['items', 'days', month] as const,
    /**
     * Las veces hechas de las tareas que se repiten entre dos días (3.6). Cuelga de `['items']`:
     * se vuelve a pedir con cualquier cambio de ítems; `completionsAll` las abarca todas.
     */
    completionsAll: ['items', 'completions'] as const,
    completions: (from: string, to: string) => ['items', 'completions', from, to] as const,
    /** Las sublistas de todas las listas: destinos de la captura y de «Mover a…» (2a.5). */
    sublists: ['items', 'sublists'] as const,
    /** Todos los ítems de todas las listas, archivadas incluidas (Buscar, fase 1). */
    all: ['items', 'all'] as const,
    /** Lo que salió de una inbox y sigue en otra lista («Fuera de la cabeza» de «En mente»). */
    movedFrom: (inboxId: string) => ['items', { movedFrom: inboxId }] as const,
    detail: (itemId: string) => ['items', itemId] as const,
  },
  /**
   * La URL firmada de una foto (2a.6). Va fuera de `['items']`: lo que recorre esas cachés
   * espera listas de ítems.
   */
  photo: (path: string, size: 'thumb' | 'full') => ['photo', path, size] as const,
  /** El título y la imagen de la página de un enlace (`fetch-metadata`). */
  // `2`: desde la 2.1 trae también el precio; lo guardado antes en caché no lo tenía.
  linkMetadata: (url: string) => ['link-metadata', 2, url] as const,
  /** El histórico de precios de una compra (2.2). */
  prices: (itemId: string) => ['prices', itemId] as const,
  /** «Ahorrado» de Perfil (2.2): fuera de `['prices']`, que son históricos de un ítem. */
  savings: ['savings'] as const,
  /** Las compras con «Avisarme si baja» (3.8): las tuyas, todas de una vez. */
  priceAlerts: ['price-alerts'] as const,
  /** «Bajaron esta mañana» (3.8): se pide al abrir la hoja. */
  priceDrops: ['price-drops'] as const,
  profile: () => ['profile'] as const,
  /** Tu enlace del Calendario del iPhone (3.7): `null` si aún no tienes. */
  calendarToken: ['calendar-token'] as const,
  /** Cuántas listas y cosas se borran con la cuenta (2.8): se pide al abrir la confirmación. */
  accountCounts: ['account', 'counts'] as const,
  /**
   * Tu caja de la clave privada y tus llaves (5.6): cifradas, así que se guardan con la caché y se
   * desbloquea sin red. Lo desbloqueado nunca va en una consulta (`meta.private`, `persister.ts`).
   */
  privateVault: ['private-vault'] as const,
  /** Tus avisos (2.6): pocos, todos de una vez. Fuera de `['items']`, que son listas de ítems. */
  reminders: ['reminders'] as const,
  /** Si este dispositivo recibe avisos (`PushState`), que solo sabe el navegador. */
  push: ['push'] as const,
  /** Compartir (3.2): el enlace activo de una lista, quién está y lo que dice un enlace. */
  sharing: {
    /** Quién está en cada lista compartida (3.3): las iniciales de toda la app. */
    shared: ['sharing', 'shared'] as const,
    departure: (listId: string) => ['sharing', 'departure', listId] as const,
    invite: (listId: string) => ['sharing', 'invite', listId] as const,
    people: (listId: string) => ['sharing', 'people', listId] as const,
    preview: (token: string) => ['sharing', 'preview', token] as const,
  },
}
