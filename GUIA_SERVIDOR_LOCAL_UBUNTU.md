# 🌿 Guía de Instalación y Operación del Servidor Local de Contingencia
### Habitik — Sistema de Alta Disponibilidad para Feria de Software 2026

Esta guía explica paso a paso cómo instalar, configurar y operar el **Backend** y la **Base de Datos PostgreSQL completa (con todos los datos reales clonados de Railway)** en cualquier computadora secundaria con Windows 10/11 o Linux, garantizando que la aplicación móvil Habitik funcione al 100% sin internet o si Railway experimenta caídas durante la feria.

---

## 📋 Requisitos Previos

En la computadora donde vayas a levantar el servidor necesitas:
1. **Windows 10 u 11** (o Linux nativo).
2. **Ubuntu en WSL 2** (para ejecutar Docker y PostgreSQL sin conflictos).
3. **Docker** (instalado dentro de Ubuntu WSL o Docker Desktop en Windows).
4. **Node.js v18+ y npm** (instalados en Windows o en Ubuntu).
5. **Git**.

---

## 🚀 Paso 1: Verificar e Instalar Ubuntu en WSL

Abre una terminal de **PowerShell** en Windows y escribe:

```powershell
wsl -l -v
```

### ¿Qué debería aparecer?
Si ya tienes Ubuntu instalado, verás algo similar a esto:
```text
  NAME      STATE           VERSION
* Ubuntu    Running         2
```

### ¿Qué hacer si NO está instalado?
Ejecuta en PowerShell como Administrador:
```powershell
wsl --install -d Ubuntu
```
Reinicia el equipo si Windows te lo solicita, abre la aplicación **Ubuntu** desde el menú Inicio y define un usuario y contraseña (por ejemplo, usuario `efrak`).

---

## 🐳 Paso 2: Instalar Docker en Ubuntu WSL

Abre la terminal de Ubuntu y ejecuta:

```bash
# 1. Actualizar repositorios e instalar paquetes base
sudo apt update && sudo apt install -y curl gnupg lsb-release

# 2. Instalar Docker
sudo apt install -y docker.io docker-compose-v2

# 3. Dar permisos a tu usuario para no requerir sudo con docker
sudo usermod -aG docker $USER

# 4. Iniciar servicio Docker
sudo service docker start
```

Para verificar que Docker está activo:
```bash
docker --version
```
*(Debe reportar Docker version 24+ o similar).*

---

## 📥 Paso 3: Clonar el Repositorio e Instalar Dependencias

Desde la terminal (PowerShell o Ubuntu):

```bash
# Clonar el proyecto si no lo tienes
git clone https://github.com/efrakingz/Project-Habitik.git
cd Project-Habitik/backend

# Instalar dependencias de Node.js
npm install
```

---

## 🐘 Paso 4: Levantar la Base de Datos Local

La base de datos corre dentro de un contenedor Docker aislado en el **puerto 5433** (para evitar cualquier colisión con instalaciones locales previas de PostgreSQL en el puerto 5432).

Ejecuta en la terminal de Ubuntu (dentro de la carpeta `backend`):
```bash
docker compose up -d
```

### ¿Cómo sé que la base de datos está lista?
El archivo `database/init_local_db.sql` se carga de forma 100% automática al arrancar el contenedor por primera vez, creando:
- **24 tablas relacionales idénticas a Railway**.
- Usuarios, familias, miembros, compras, logros, trivia, palabras de wordle, etc.
- Puedes verificar su estado en cualquier momento con:
```bash
docker ps
```
*(Debe figurar el contenedor `habitik_postgres_local` con estado `Up (healthy)` en el puerto `0.0.0.0:5433->5432/tcp`).*

---

## 🎛️ Paso 5: Iniciar el Panel de Control Pro

Hemos desarrollado un panel de control interactivo visual de última generación para operar todo el servidor sin comandos manuales:

### Forma 1 (La más fácil):
Haz doble clic en:
📁 **`Panel_Control_Habitik.bat`** (ubicado en el Escritorio o en la raíz del proyecto).

### Forma 2 (Desde la terminal):
```bash
cd backend
node scripts/control_gui.js
```

Se abrirá inmediatamente en tu navegador web:
👉 **`http://localhost:3333`**

---

## 🖥️ Arquitectura del Panel de Control Pro

El nuevo panel cuenta con un diseño profesional de pantalla dividida (Split-Screen) en dos columnas:

```
┌───────────────────────────────────────┬───────────────────────────────────────────┐
│        COLUMNA IZQUIERDA              │           COLUMNA DERECHA                 │
│      (Controles y Telemetría)         │      (Consola de Terminal en Vivo)        │
├───────────────────────────────────────┼───────────────────────────────────────────┤
│ 🚀 Servidor Backend API (Puerto 3000) │ >_ habitik-backend:~$ logs --tail         │
│    [Switch Encender / Apagar]         │                                           │
│    [Botón Reiniciar Proceso]          │ [Filtros: Todos | Backend | BD | Errores] │
│                                       │ [Auto-Scroll: ON] [Copiar] [Limpiar]      │
│ 🐘 PostgreSQL Docker (Puerto 5433)    │                                           │
│    [Switch Encender / Detener]        │ [14:02:11] 🚀 Backend iniciado en :3000   │
│    [Botón Restaurar BD Limpia]        │ [14:02:12] 🐘 PostgreSQL pool conectado   │
│                                       │ [14:02:14] 📡 [Auto-Discovery] Baliza UDP │
│ 📡 Red Wi-Fi y Conectividad           │ [14:02:15] ⚡ [Socket.io] Cliente activo  │
│    IP Local: 192.168.1.10             │                                           │
│    URL: http://192.168.1.10:3000      │                                           │
│    [⚡ Probar Conexión (Ping)]        │                                           │
│    [Código QR Dinámico Integrado]     │ >_ Escribe un comando (ping, restart)...  │
└───────────────────────────────────────┴───────────────────────────────────────────┘
```

### Funcionalidades Clave del Panel:
1. **⚡ Probar Conexión (Ping)**:
   - Ejecuta una comprobación HTTP interna directa del lado del servidor contra `http://127.0.0.1:3000/`.
   - Muestra la latencia en milisegundos en tiempo real (ej. `🟢 3 ms • Backend Online`).
   - 100% inmune a bloqueos CORS o directivas de red privada del navegador.
2. **🔄 Restaurar Base de Datos**:
   - Vuelve a volcar `database/init_local_db.sql` sin necesidad de reiniciar el contenedor.
3. **📡 Baliza de Auto-Descubrimiento (UDP Beacon)**:
   - Escucha en el puerto `3334`. Cuando un celular o tablet abre Habitik, el backend responde en menos de 10 milisegundos anunciando su IP y puerto automáticamente.
4. **Consola en Vivo a la Derecha**:
   - Actualización continua sin recargar la página.
   - Coloreado inteligente de logs (éxito en verde, errores en rojo, WebSockets en cian).
   - Permite pausar el autoscroll o filtrar únicamente por errores o eventos de base de datos.
   - Línea de comandos en el pie para escribir órdenes rápidas (`ping`, `restart`, `clear`).

---

## 📱 Paso 6: Conectar Celulares y Tablets en la Feria

### Opción A: Zona Wi-Fi Portátil / Hotspot Móvil (RECOMENDADO para la feria)
No dependas de la red Wi-Fi del stand, que suele estar saturada:
1. En tu celular, activa la **Zona Wi-Fi portátil / Hotspot Móvil**.
2. Conecta el notebook del servidor y las tablets a esa red Wi-Fi del celular.
3. El panel detectará instantáneamente la nueva IP (ejemplo: `192.168.43.15`).

### Opción B: Router Wi-Fi del Stand
Conecta tanto la notebook como los teléfonos a la misma red Wi-Fi del evento.

---

## 📲 Paso 7: Configurar la App Habitik (Flutter)

1. Abre **Habitik** en el celular o tablet.
2. En la pantalla de **Login**, toca el botón con el ícono de engranaje o selector de red (`☁️ Nube`).
3. Elige **💻 Servidor Local (Wi-Fi / Notebook)**.
4. Tienes **3 formas ultrarrápidas de conectarte**:
   - **Método 1 (1 solo toque - Recomendado):**
     Presiona el botón verde **"🔍 Auto-Detectar en Wi-Fi"**. El algoritmo escaneará la red local vía UDP y barrido de subred. En 1 segundo encontrará la notebook, probará la conexión y completará la IP por ti.
   - **Método 2 (Cámara):**
     Presiona **"📷 Escanear QR"** y apunta la cámara al código QR que muestra el Panel Web en la pantalla de la notebook.
   - **Método 3 (Manual):**
     Escribe o copia la IP que indica el panel (ej. `http://192.168.1.10:3000`).
5. Presiona **"Guardar y Usar"**.
6. ¡Listo! La app cambiará dinámicamente sus conexiones HTTP y de WebSockets al servidor local de alta velocidad.

---

## 🛠️ Solución de Problemas Frecuentes

### 1. "Error: listen EADDRINUSE: address already in use 0.0.0.0:3333"
El nuevo script `control_gui.js` incluye limpieza automática de procesos huérfanos antes de abrir el puerto. Si ocurriera manualmente, puedes matar el proceso previo con:
```powershell
netstat -ano | findstr :3333
taskkill /pid <PID> /F
```

### 2. El celular no detecta el servidor en la red Wi-Fi
- Verifica que el Firewall de Windows permita conexiones entrantes a Node.js en el puerto `3000` y `3334`. En PowerShell como Administrador:
```powershell
New-NetFirewallRule -DisplayName "Habitik Backend Local" -Direction Inbound -LocalPort 3000,3334 -Protocol TCP,UDP -Action Allow
```
- Asegúrate de que la red Wi-Fi en Windows esté configurada como **"Red privada"** y no como "Red pública".

### 3. La base de datos no inicia
- Comprueba que el servicio de Docker esté corriendo dentro de Ubuntu WSL:
```bash
wsl -d Ubuntu -- sudo service docker status
wsl -d Ubuntu -- sudo service docker start
```
