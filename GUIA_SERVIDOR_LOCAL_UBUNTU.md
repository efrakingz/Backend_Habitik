# 🌿 Guía de Instalación y Operación del Servidor Local de Contingencia
### Habitik — Sistema Orquestado de Alta Disponibilidad (Feria de Software 2026)

Esta guía explica paso a paso cómo instalar, configurar y operar el **Backend** y la **Base de Datos PostgreSQL completa (con todos los datos reales clonados de Railway)** en cualquier computadora con Windows 10/11 o Linux.

Cuenta con un **Interruptor Maestro Unificado** con orquestación secuencial (encendido controlado por etapas) y un **Guardián Autónomo (Watchdog)** para que la base de datos y el backend funcionen siempre sincronizados sin caídas inesperadas.

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
*(Debe reportar Docker version 24+ o 29+).*

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

## 🎛️ Paso 4: Iniciar el Panel de Control con Interruptor Maestro

Ya no necesitas ejecutar comandos manuales ni prender los servicios por separado:

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

## 🕹️ Operación con 1 Solo Botón (Orquestación Inteligente)

En el panel verás un gran **Botón Maestro Central**:

```
┌────────────────────────────────────────────────────────┐
│             INTERRUPTOR MAESTRO UNIFICADO              │
│                                                        │
│   🚀 INICIAR SERVIDOR COMPLETO                         │
│   Levanta Docker PostgreSQL + Backend sincronizados   │
└────────────────────────────────────────────────────────┘
```

### ¿Qué ocurre internamente al presionar "Iniciar Servidor"?
1. **Etapa 1 (Base de Datos Docker):** Levanta el contenedor `habitik_postgres_local` en el puerto aislado `5433` (con sus 24 tablas de Railway).
2. **Etapa 2 (Espera activa & Healthcheck):** El sistema sondea el socket de PostgreSQL cada 500ms hasta confirmar que está 100% listo para responder consultas SQL.
3. **Etapa 3 (Backend Express):** Solo cuando la base de datos está confirmada y conectada, arranca el backend Node.js en el puerto `3000`.
4. **Etapa 4 (Comprobación HTTP & Baliza UDP):** Ejecuta un ping de validación y activa la baliza UDP en el puerto `3334` para que los celulares lo encuentren al instante.
5. **Resultado:** El botón cambia a color rojo: **`🛑 APAGAR SERVIDOR HABITIK`** y el badge muestra `🟢 SISTEMA 100% OPERATIVO`.

---

## 🛡️ Guardián Autónomo (Watchdog & Auto-Healing)

El panel incorpora un vigilante que revisa el estado de los puertos `5433` y `3000` cada 4.5 segundos:
* Si Docker o PostgreSQL se suspenden por inactividad del sistema operativo:
  1. El Guardián lo detecta automáticamente.
  2. Levanta el contenedor de Docker de inmediato.
  3. Reconecta el pool de base de datos del backend.
  4. **Evita de raíz el error `ECONNREFUSED 127.0.0.1:5433`**.

---

## 📱 Paso 5: Conectar Celulares y Tablets en la Feria

### Opción A: Zona Wi-Fi Portátil / Hotspot Móvil (RECOMENDADO para la feria)
No dependas de la red Wi-Fi del stand, que suele saturarse:
1. En tu celular, activa la **Zona Wi-Fi portátil / Hotspot Móvil**.
2. Conecta el notebook del servidor y las tablets a esa red Wi-Fi del celular.
3. El panel detectará instantáneamente la nueva IP (ejemplo: `192.168.43.15`).

### Opción B: Router Wi-Fi del Stand
Conecta tanto la notebook como los teléfonos a la misma red Wi-Fi del evento.

---

## 📲 Paso 6: Configurar la App Habitik (Flutter)

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

## 🛠️ Comandos de Terminal Rápida (Pie de Consola Web)

En el panel web, al pie de la consola de la derecha, puedes escribir directamente:
- `start` -> Inicia el sistema completo de forma orquestada.
- `stop` -> Detiene el backend y la base de datos limpiamente.
- `restart` -> Reinicia todo el entorno.
- `ping` -> Prueba la latencia real en milisegundos.
- `restore` -> Recarga los datos iniciales de las 24 tablas desde `database/init_local_db.sql`.
- `clear` -> Limpia la ventana de logs.
