# Edge functions

Aquí vivirán las edge functions de Supabase (Deno), una carpeta por función:

- **Scraper de precios**: consulta periódicamente las URLs de productos y guarda el histórico
  de precios.
- **Envío de push**: envía las notificaciones Web Push de los recordatorios.

Crear una nueva función:

```bash
pnpm exec supabase functions new <nombre>
pnpm exec supabase functions serve        # servirlas en local
```

Ninguna está creada todavía.
