# private

La clave privada (5.6, [ADR-013](../../../docs/concept/decisiones/ADR-013-que-protege-lo-privado.md),
diseño 26): una caja con una clave al azar que se abre en el aparato con la clave privada o con la
llave de acceso del aparato (Face ID, la huella, Touch ID, Windows Hello). La usan las notas
protegidas (5.7) y las listas ocultas (5.8).

- `vault.ts` (puro, WebCrypto): la clave de la caja, PBKDF2 para la clave privada, HKDF para lo
  que da PRF, cifrar y descifrar la caja y el comprobador.
- `passkey.ts`: crear y usar la llave de este aparato (WebAuthn con PRF) y cómo se llama aquí
  (`deviceUnlock`: «Face ID en este iPhone», «Touch ID en este Mac»…).
- `unlock.ts`: lo desbloqueado, solo en memoria; se bloquea a los 5 minutos y al salir de la app.
- `deviceKey.ts`: cuál es la llave de este aparato y si aquí no hay PRF (`localStorage`).
- `api.ts` y `queries.ts`: la caja y las llaves (cifradas: van en la caché para desbloquear sin
  red), `reset_private_vault` y el código por email de «He olvidado la clave».
- `operations.ts`: crear, abrir con la clave o con la llave, cambiar la clave y añadir la llave.
- `components/`: `PrivateProvider` (en el layout privado, con `usePrivate().requestUnlock()` para
  lo que necesite desbloquear) y sus hojas: crear, desbloquear, cambiar, «He olvidado la clave»,
  el código y la oferta de Face ID; `PrivateSection` es Perfil › «Privado».
