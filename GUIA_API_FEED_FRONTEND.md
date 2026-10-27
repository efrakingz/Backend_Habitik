# 📱 Guía de Integración API: Muro Social y Feed Familiar (HU 4.1)

Esta guía documenta los endpoints y contratos JSON del backend de **Habitik** para el consumo del equipo de Frontend (Flutter / Web).

---

## 🔐 Autenticación
Todos los endpoints requieren el token JWT en las cabeceras HTTP:
```http
Authorization: Bearer <tu_jwt_token>
```
El token identifica automáticamente al usuario (`user_id`) y a su grupo familiar (`family_id`).

---

## 1. `GET /feed` (o `GET /api/familia/feed`)
Obtiene el muro de actividades cronológicas de la familia (Speedruns, tareas del hogar completadas, retos con fotos, medallas y canjes), con soporte para avatares, fotos, y agregación de reacciones/likes.

### 📥 Parámetros de Consulta (Query Params)
| Parámetro | Tipo | Requerido | Por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `limit` | `number` | No | `20` | Cantidad de publicaciones por página (máx. 100). |
| `cursor` | `string` | No | `null` | Fecha ISO (`next_cursor`) para scroll infinito / paginación hacia atrás. |

#### Ejemplo de Petición:
```http
GET /feed?limit=15 HTTP/1.1
Authorization: Bearer eyJhbGciOi...
```

Con scroll infinito:
```http
GET /feed?limit=15&cursor=2026-09-22T13:36:32.899Z HTTP/1.1
Authorization: Bearer eyJhbGciOi...
```

---

### 📤 Respuesta Exitosa (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "4",
      "user_id": "5f0813c3-216e-4158-b1b9-af2abbb845d0",
      "nombre": "Cristóbal",
      "avatar": {
        "url": null,
        "color": "#2e7d32",
        "letra": "C"
      },
      "tipo": "speedrun_ducha",
      "mensaje": "Cristóbal completó el Speedrun de la Ducha en 4m 20s.",
      "imagen_url": null,
      "recompensas": {
        "xp": 200,
        "monedas": 2
      },
      "fecha": "2026-10-27T18:40:00.000Z",
      "total_reacciones": 3,
      "reacciones_conteo": {
        "fuego": 2,
        "aplauso": 1
      },
      "mi_reaccion": "fuego",
      "reacciones": [
        {
          "id": "3c0f0195-dd0d-49fc-9e4a-ef30541dfc4e",
          "tipo": "fuego",
          "user_id": "5f0813c3-216e-4158-b1b9-af2abbb845d0",
          "usuario_nombre": "Cristóbal",
          "created_at": "2026-10-27T18:40:44.123Z"
        }
      ]
    },
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
      "user_id": "98765432-1234-5678-abcd-0987654321ba",
      "nombre": "Thomas",
      "avatar": {
        "url": "https://cdn.habitik.app/avatars/thomas.png",
        "color": "#1976D2",
        "letra": "T"
      },
      "tipo": "tarea_completada",
      "mensaje": "Thomas completó la tarea: \"Desconectar cargadores del living\".",
      "imagen_url": "https://storage.habitik.app/evidencias/tarea_123.jpg",
      "recompensas": {
        "xp": 100,
        "monedas": 0
      },
      "fecha": "2026-10-27T17:15:00.000Z",
      "total_reacciones": 0,
      "reacciones_conteo": {},
      "mi_reaccion": null,
      "reacciones": []
    }
  ],
  "pagination": {
    "limit": 20,
    "count": 2,
    "next_cursor": "2026-10-27T17:15:00.000Z",
    "has_more": false
  }
}
```

---

## 2. `POST /feed/:id/react` (o `POST /api/familia/feed/:id/react`)
Permite reaccionar o dar "like" a cualquier publicación del muro.

> [!TIP]
> **Comportamiento Toggle Inteligente:**
> - Si envías un emoji nuevo (ej: `"fuego"`): la reacción se crea (`"accion": "creada"`).
> - Si vuelves a enviar el **mismo emoji**: se retira automáticamente (`"accion": "eliminada"`).
> - Si envías un emoji distinto al que tenías (ej: cambias de `"like"` a `"aplauso"`): se actualiza (`"accion": "actualizada"`).

### 📥 Parámetros de Ruta (URL Params)
- `:id`: ID de la actividad (campo `id` obtenido en el `GET /feed`).

### 📥 Cuerpo de la Petición (Request Body)
```json
{
  "tipo": "fuego"
}
```
*Tipos soportados sugeridos:* `'like'`, `'fuego'`, `'aplauso'`, `'corazon'`, `'planta'` (o cualquier string en minúsculas). Por defecto es `'like'`.

---

### 📤 Respuestas del Endpoint de Reacción

#### A. Reacción Agregada (`200 OK`)
```json
{
  "success": true,
  "message": "Reacción agregada.",
  "data": {
    "accion": "creada",
    "tipo": "fuego",
    "reaccionado": true,
    "total_reacciones": 1,
    "reacciones_conteo": {
      "fuego": 1
    },
    "usuario_nombre": "Cristóbal"
  }
}
```

#### B. Reacción Removida (Toggle Off - `200 OK`)
```json
{
  "success": true,
  "message": "Reacción removida.",
  "data": {
    "accion": "eliminada",
    "tipo": "fuego",
    "reaccionado": false,
    "total_reacciones": 0,
    "reacciones_conteo": {},
    "usuario_nombre": "Cristóbal"
  }
}
```

#### C. Reacción Cambiada (`200 OK`)
```json
{
  "success": true,
  "message": "Reacción actualizada.",
  "data": {
    "accion": "actualizada",
    "tipo": "corazon",
    "reaccionado": true,
    "total_reacciones": 1,
    "reacciones_conteo": {
      "corazon": 1
    },
    "usuario_nombre": "Cristóbal"
  }
}
```

---

## 3. `DELETE /feed/:id/react`
Si el frontend prefiere un endpoint explícito para des-reaccionar sin depender del toggle:
```http
DELETE /feed/4/react HTTP/1.1
Authorization: Bearer <jwt>
```

---

## 4. ⚡ Actualización en Tiempo Real (WebSockets / Socket.io)

Cuando cualquier familiar reacciona a una actividad, el backend emite automáticamente un evento a la sala familiar (`familia_${family_id}`).

### 📡 Suscripción en el Frontend
```javascript
// Conectar a Socket.io
const socket = io("https://tu-backend-habitik.railway.app");

// Escuchar eventos en vivo
socket.on("evento_en_vivo", (evento) => {
  if (evento.tipo === "FEED_REACCION") {
    console.log("Nueva reacción en vivo:", evento.payload);
    // evento.payload contiene:
    // {
    //   feed_id: "4",
    //   tipo: "fuego",
    //   accion: "creada", // o "eliminada" o "actualizada"
    //   total_reacciones: 2,
    //   reacciones_conteo: { fuego: 2 }
    // }
    // -> Actualizar en memoria el ítem con id == feed_id sin recargar todo el feed!
  }
});
```

---

## 5. 🏷️ Catálogo de Tipos de Actividades (`tipo`)
Para mostrar íconos o etiquetas específicas en la tarjeta de cada actividad:

| Valor `tipo` | Significado | ¿Trae Foto (`imagen_url`)? |
| :--- | :--- | :--- |
| `speedrun_ducha` | Ducha rápida completada con éxito. | `null` |
| `tarea_completada` | Tarea del hogar marcada como hecha. | Opcional (URL o Base64 si adjuntó foto). |
| `reto_evidencia` | Reto Cazador de Sombras / Desafío ecológico. | Sí (Foto de evidencia fotográfica). |
| `evidencia_accion` | Reporte directo de evidencia familiar. | Sí (URL de la foto). |
| `logro` | Medalla o trofeo desbloqueado. | `null` o ícono de la medalla. |
| `canje` | Canje de recompensa en la tienda familiar. | `null` |
| `eco_puzzle` | Mini-juego Eco-Puzzle resuelto. | `null` |
| `wordle` | Adivinanza en Eco-Wordle. | `null` |
| `bonus_constancia`| Recompensa por racha diaria consecutiva. | `null` |
| `recompensa_nivel`| Subida de nivel en el juego. | `null` |

---

## 6. 🎨 Sugerencias para el Frontend

1. **Avatar:**
   - Si `avatar.url` no es nulo, renderizar la imagen `Image.network(avatar.url)`.
   - Si `avatar.url` es nulo, renderizar un `CircleAvatar` con el color de fondo `avatar.color` (ej: `#2e7d32`) y la letra `avatar.letra` (ej: `"C"`).
2. **Botón de Reacción Activo:**
   - Utilizar el campo `item.mi_reaccion`. Si `item.mi_reaccion !== null`, pintar el botón activo o con el emoji seleccionado por el usuario.
3. **Scroll Infinito:**
   - Si `pagination.has_more === true`, llamar al siguiente lote enviando `?cursor=${pagination.next_cursor}` al hacer scroll hacia el final de la lista.
