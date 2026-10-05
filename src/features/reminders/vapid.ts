/**
 * La clave pública VAPID de la app (2.6): con ella el navegador sabe que los push de esta
 * suscripción solo los puede mandar quien tiene la privada, que es un secreto de las edge
 * functions (`VAPID_PRIVATE_KEY`, 2.7) y nunca sale de ahí. Es pública por diseño: va en el
 * código, no hace falta como variable de entorno. Si se cambia el par, todas las suscripciones
 * se rehacen.
 */
export const VAPID_PUBLIC_KEY =
  'BGA_Yb5OLyw9z6kxTSMH_RySTMf2-9b6U344fXU5wzugTNhV2Cp-5QC1eXU4h6a4RjFbRRC3ysZDBojmg5OuT2Q'
