# 🌿 Guía de Servidor Local de Contingencia (Habitik - Feria de Software)

Esta guía te permite levantar el **Backend** y la **Base de Datos PostgreSQL completa (con todos los datos reales clonados de Railway)** en tu notebook usando **Ubuntu (WSL)** o Docker, para que tu app en celulares y tablets funcione **100% sin internet** o si Railway se satura en la feria.

---

## 1. Verificar si tienes Ubuntu (WSL) instalado

En tu computadora Windows (PowerShell o CMD), escribe:
```powershell
wsl -l -v
```

Si aparece algo como:
```text
  NAME      STATE           VERSION
* Ubuntu    Running         2
```
¡Ya tienes Ubuntu instalado y listo para usar!

> 💡 **Nota:** Si no estuviera instalado, en PowerShell como Administrador se instala en 1 minuto con:
> ```powershell
> wsl --install -d Ubuntu
> ```

---

## 2. Preparar Ubuntu en 1 solo comando

Abre tu terminal de Ubuntu (`efrak@server:~$`) y navega a la carpeta del backend:
```bash
cd "/mnt/c/Users/efrak/OneDrive/Documentos/Proyectos/proyecto Habitik/backend"
```

Asegúrate de tener instalados PostgreSQL y Node.js:
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib nodejs npm
```

Dar permisos de ejecución al panel interactivo:
```bash
chmod +x scripts/control_panel.sh
```

---

## 3. Panel de Control Interactivo (El "Botón de Encendido")

Para no tener que memorizar comandos en la feria, hemos creado una interfaz visual interactiva en la terminal:

Ejecuta en tu terminal de Ubuntu:
```bash
./scripts/control_panel.sh
```
*(O también desde Windows/WSL con: `npm run server:control`)*

Verás un panel como este:
```text
╔══════════════════════════════════════════════════════╗
║       🌿 HABITIK - PANEL DE SERVIDOR LOCAL           ║
║           (Servidor de Contingencia Feria)           ║
╚══════════════════════════════════════════════════════╝

  📡 Tu IP Local (Wi-Fi): 192.168.1.50
  📱 URL para la App:     http://192.168.1.50:3000
  ⚡ Estado:              🟢 ONLINE

  [1] 🟢 Iniciar Todo (Base de Datos + Backend en Wi-Fi)
  [2] 🔴 Detener Todo
  [3] 🔄 Restaurar / Recargar Base de Datos Local (SQL)
  [4] 📥 Descargar Volcado Fresco desde Railway
  [5] 📋 Ver Logs del Backend en Vivo
  [6] 🚪 Salir
```

### ¿Qué hace cada opción?
- **Opción `[1]` (Iniciar Todo):**
  1. Arranca PostgreSQL localmente de forma automática.
  2. Detecta la IP exacta de tu notebook en la red Wi-Fi (ej. `192.168.1.50`).
  3. Inicia el backend Node.js en `0.0.0.0:3000` para que cualquier celular o tablet de la red pueda conectarse.
- **Opción `[2]` (Detener Todo):** Apaga los servicios locales al terminar la presentación.
- **Opción `[3]` (Restaurar Base de Datos):** Carga el archivo `database/init_local_db.sql` con las 24 tablas y todos los datos reales (usuarios, familias, trivia, wordle, etc.) en tu PostgreSQL local.

---

## 4. Conectar Celulares y Tablets en la Feria

### Escenario A: Hay red Wi-Fi en el stand
1. Conecta tu notebook, tablet y celular a la **misma red Wi-Fi**.
2. Mira la IP que te indica el panel de control (ejemplo: `http://192.168.43.15:3000`).

### Escenario B: No hay internet en la feria (Recomendado para máxima velocidad)
1. En tu celular, activa la **"Zona Wi-Fi portátil / Hotspot Móvil"**.
2. Conecta tu notebook y tu tablet a la red Wi-Fi que creó tu celular.
3. ¡Listo! Tendrás una red de área local privada de ultra-alta velocidad sin gastar datos y sin caídas de internet.

---

## 5. Seleccionar Servidor en la App Móvil (Flutter)

1. Abre la app **Habitik** en tu tablet o celular.
2. En la pantalla de **Login**, en la esquina superior izquierda verás el botón:
   - `☁️ Nube` (Conectado a Railway por defecto).
3. Tócalo para abrir el modal **"Servidor de Conexión"**:
   - Selecciona **💻 Servidor Local (Wi-Fi / Notebook)**.
   - Ingresa la dirección IP que te mostró el panel (ejemplo: `http://192.168.43.15:3000`).
   - Presiona el botón **"Probar Conexión"** para verificar que responda con check verde (`✅ Conexión exitosa`).
   - Toca **"Guardar y Usar"**.
4. ¡Inicia sesión con normalidad! La app recordará tu servidor local incluso si cierras la app.

---

## 6. Alternativa con Docker (Opcional)

Si prefieres usar Docker en lugar de PostgreSQL nativo:
```bash
# Iniciar base de datos local
docker compose up -d postgres_local

# Detener
docker compose stop postgres_local
```
*(El archivo `database/init_local_db.sql` ya está enlazado en `docker-compose.yml` para cargarse solo al primer inicio).*
