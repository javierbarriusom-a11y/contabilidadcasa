# Activar base de datos con Supabase

La app ya esta preparada para funcionar en modo local o en modo nube. Si `supabase-config.js` no tiene claves, sigue usando el navegador. Si tiene claves de Supabase, aparece login y sincroniza entre sesiones.

## 1. Crear proyecto

1. Entra en https://supabase.com.
2. Crea un proyecto nuevo.
3. En `SQL Editor`, pega y ejecuta el contenido de `supabase_schema.sql`.

## 2. Copiar claves publicas

En Supabase, ve a `Project Settings` > `API` y copia:

- Project URL
- anon public key

Edita `supabase-config.js`:

```js
window.SUPABASE_CONFIG = {
  url: "https://TU_PROYECTO.supabase.co",
  anonKey: "TU_ANON_PUBLIC_KEY",
};
```

La `anon public key` puede estar en el navegador siempre que Row Level Security este activado. No pegues nunca la `service_role key`.

## 3. Publicar

```bash
git add index.html app.js styles.css supabase-config.js supabase_schema.sql SUPABASE_SETUP.md
git commit -m "Activar sincronizacion Supabase"
git push
```

## 4. Usar

1. Abre la web publicada.
2. En el panel lateral `Sincronizacion`, crea cuenta o entra.
3. La primera vez, si no hay datos en la nube, subira el estado local actual.
4. En otros ordenadores, entra con el mismo usuario y recuperara proyectos, reales, conceptos y saldos.
