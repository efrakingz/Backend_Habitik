#!/bin/bash

# ========================================================
# HABITIK - PANEL DE CONTROL SERVIDOR LOCAL (UBUNTU / WSL)
# ========================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Directorio base del backend
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"

# Obtener IP local de la red Wi-Fi / LAN
get_local_ip() {
  # Intento 1: hostname -I (primera IP que no sea loopback)
  local ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -z "$ip" ]; then
    # Intento 2: ip route
    ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
  fi
  if [ -z "$ip" ]; then
    ip="127.0.0.1"
  fi
  echo "$ip"
}

check_postgres() {
  if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo -e "${GREEN}🟢 PostgreSQL Local Activo (Puerto 5432)${NC}"
    return 0
  elif command -v docker >/dev/null 2>&1 && docker ps | grep -q habitik_postgres_local; then
    echo -e "${GREEN}🟢 PostgreSQL en Docker Activo (Puerto 5432)${NC}"
    return 0
  else
    echo -e "${RED}🔴 PostgreSQL Inactivo${NC}"
    return 1
  fi
}

check_backend() {
  if curl -s http://localhost:3000/ >/dev/null 2>&1; then
    echo -e "${GREEN}🟢 Backend Habitik Activo (http://localhost:3000)${NC}"
    return 0
  else
    echo -e "${RED}🔴 Backend Habitik Inactivo${NC}"
    return 1
  fi
}

start_database() {
  echo -e "\n${YELLOW}⚙️  Iniciando base de datos PostgreSQL local...${NC}"

  # Opción 1: Si postgresql nativo está instalado en Ubuntu
  if command -v psql >/dev/null 2>&1 && command -v service >/dev/null 2>&1; then
    echo -e "${CYAN}→ Arrancando servicio PostgreSQL en Ubuntu...${NC}"
    sudo service postgresql start
    
    # Crear base de datos local y usuario si no existen
    sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgrespassword123' SUPERUSER;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE habitik_local OWNER postgres;" 2>/dev/null || true
  
  # Opción 2: Usar Docker Compose
  elif command -v docker >/dev/null 2>&1; then
    echo -e "${CYAN}→ Arrancando contenedor Docker con PostgreSQL...${NC}"
    docker compose up -d postgres_local
  else
    echo -e "${RED}⚠️  No se encontró PostgreSQL ni Docker. Instálalo con:${NC}"
    echo -e "   sudo apt update && sudo apt install -y postgresql postgresql-contrib"
    return 1
  fi

  sleep 2
  check_postgres
}

restore_database() {
  echo -e "\n${YELLOW}🔄 Restaurando base de datos local desde init_local_db.sql...${NC}"
  local dump_file="$BACKEND_DIR/database/init_local_db.sql"

  if [ ! -f "$dump_file" ]; then
    echo -e "${RED}❌ Archivo $dump_file no encontrado. Ejecuta 'npm run db:dump' primero.${NC}"
    return 1
  fi

  # Restaurar con psql nativo o docker exec
  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD=postgrespassword123 psql -h localhost -U postgres -d habitik_local -f "$dump_file" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✅ Base de datos restaurada exitosamente con datos reales de Railway.${NC}"
    else
      # Intento con usuario postgres sin password local
      sudo -u postgres psql -d habitik_local -f "$dump_file" >/dev/null 2>&1
      echo -e "${GREEN}✅ Base de datos restaurada exitosamente.${NC}"
    fi
  elif command -v docker >/dev/null 2>&1; then
    docker exec -i habitik_postgres_local psql -U postgres -d habitik_local < "$dump_file" >/dev/null 2>&1
    echo -e "${GREEN}✅ Base de datos restaurada exitosamente en Docker.${NC}"
  fi
}

start_backend() {
  echo -e "\n${YELLOW}🚀 Iniciando Backend Habitik en segundo plano...${NC}"
  local local_ip=$(get_local_ip)

  # Detener procesos previos en puerto 3000 si existen
  fuser -k 3000/tcp >/dev/null 2>&1 || true

  # Cargar .env.local y arrancar
  export DATABASE_URL="postgresql://postgres:postgrespassword123@localhost:5432/habitik_local"
  export PORT=3000
  export HOST="0.0.0.0"

  nohup npm run build >/dev/null 2>&1 && nohup node dist/server.js > backend_local.log 2>&1 &

  echo -e "${CYAN}Esperando a que el backend responda...${NC}"
  for i in {1..10}; do
    if curl -s http://localhost:3000/ >/dev/null 2>&1; then
      echo -e "\n${GREEN}========================================================${NC}"
      echo -e "${GREEN}  🎉 SERVIDOR LOCAL HABITIK EN LÍNEA Y OPERATIVO${NC}"
      echo -e "${GREEN}========================================================${NC}"
      echo -e "  💻 URL Local Notebook: ${CYAN}http://localhost:3000${NC}"
      echo -e "  📱 URL para Tablets y Celulares (Misma Red Wi-Fi):"
      echo -e "     ${YELLOW}👉  http://${local_ip}:3000  👈${NC}"
      echo -e "${GREEN}========================================================${NC}\n"
      return 0
    fi
    sleep 1
  done

  echo -e "${YELLOW}⚠️  El backend está tardando. Revisa los logs con: tail -f backend_local.log${NC}"
}

stop_all() {
  echo -e "\n${RED}🛑 Deteniendo servicios locales...${NC}"
  fuser -k 3000/tcp >/dev/null 2>&1 || true
  pkill -f "node dist/server.js" >/dev/null 2>&1 || true

  if command -v docker >/dev/null 2>&1; then
    docker compose stop postgres_local >/dev/null 2>&1 || true
  fi

  echo -e "${GREEN}✅ Todos los servicios locales han sido detenidos.${NC}"
}

show_status() {
  local local_ip=$(get_local_ip)
  echo -e "\n${BLUE}================ ESTADO ACTUAL =================${NC}"
  echo -e "  📡 IP Red Local Wi-Fi: ${YELLOW}${local_ip}${NC}"
  echo -e "  📱 URL para la App:     ${YELLOW}http://${local_ip}:3000${NC}"
  echo -e "------------------------------------------------"
  check_postgres
  check_backend
  echo -e "${BLUE}================================================${NC}\n"
}

# Bucle principal de interfaz interactiva
while true; do
  clear
  echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║       🌿 HABITIK - PANEL DE SERVIDOR LOCAL           ║${NC}"
  echo -e "${GREEN}║           (Servidor de Contingencia Feria)           ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  show_status

  echo -e "  ${CYAN}[1]${NC} 🟢 Iniciar Todo (Base de Datos + Backend en Wi-Fi)"
  echo -e "  ${CYAN}[2]${NC} 🔴 Detener Todo"
  echo -e "  ${CYAN}[3]${NC} 🔄 Restaurar / Recargar Base de Datos Local (SQL)"
  echo -e "  ${CYAN}[4]${NC} 📥 Descargar Volcado Fresco desde Railway"
  echo -e "  ${CYAN}[5]${NC} 📋 Ver Logs del Backend en Vivo"
  echo -e "  ${CYAN}[6]${NC} 🚪 Salir"
  echo ""
  read -p "  Selecciona una opción [1-6]: " opcion

  case $opcion in
    1)
      start_database
      start_backend
      read -p "Presiona Enter para continuar..."
      ;;
    2)
      stop_all
      read -p "Presiona Enter para continuar..."
      ;;
    3)
      restore_database
      read -p "Presiona Enter para continuar..."
      ;;
    4)
      npm run db:dump
      read -p "Presiona Enter para continuar..."
      ;;
    5)
      echo -e "${CYAN}Mostrando logs (Ctrl+C para salir):${NC}"
      tail -f backend_local.log 2>/dev/null || echo "No hay logs disponibles aún."
      ;;
    6)
      echo -e "\n👋 ¡Hasta luego! Mucho éxito en la feria."
      exit 0
      ;;
    *)
      echo -e "${RED}Opción no válida.${NC}"
      sleep 1
      ;;
  esac
done
