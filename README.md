# Campeonato de Lucha de Brazos

Plataforma para inscribir alumnos y llevar en vivo un campeonato de lucha de brazos con llaves de doble eliminación.

## Páginas

| Página | Para quién | Qué hace |
| --- | --- | --- |
| `/` | Alumnos | Ficha de inscripción. Aplica cupos, la regla de Mecánica Automotriz y evita duplicados. |
| `/llaves` | Público | Llaves, próximas luchas y podio en vivo, solo lectura. Se actualiza sola cada 5 segundos. |
| `/admin` | Organizador | Competidores, pesaje, sorteo, marcar ganadores, deshacer, podio y links para compartir. Pide clave. |

## Reglas del campeonato

- Categorías de peso (-70, -80, -90, -100, +100 kg): solo brazo derecho, solo alumnos de Mecánica Automotriz, 8 cupos cada una.
- Libre brazo derecho y libre brazo izquierdo: abiertas a todas las carreras de Inacap, 16 cupos cada una.
- Doble eliminación. Todo a un pulso, salvo la final de 1° y 2° (y la final decisiva, si se juega), que va al mejor de 3.
- Al sortear una categoría se cierra su inscripción.

Las reglas están en `motor.js`.

## Publicar en Vercel

1. Entra a [vercel.com](https://vercel.com) con **Continue with GitHub**.
2. **Add New → Project**, elige `campeonato-armwrestling` y presiona **Deploy** sin cambiar nada.
3. En el proyecto, pestaña **Storage**: crea una base **Upstash for Redis** (plan gratis) y conéctala al proyecto.
4. En **Settings → Environment Variables** agrega `ADMIN_CLAVE` con la clave que usarás para entrar a `/admin`.
5. En **Deployments**, abre el último y presiona **Redeploy** para que tome la base de datos y la clave.

## Probar en tu computador

```
npm run dev     # http://localhost:3000, clave de organizador: prueba
npm test
```

Sin base de datos configurada, el servidor local guarda todo en memoria.
