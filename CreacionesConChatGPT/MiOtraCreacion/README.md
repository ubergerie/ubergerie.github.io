# [![CI](https://github.com/ubergerie/ubergerie.github.io/actions/workflows/ci.yml/badge.svg)](https://github.com/ubergerie/ubergerie.github.io/actions)

# Docker

Para ejecutar el backend y una base de datos MySQL localmente usando Docker:

1. Copia `backend/.env` y adapta las variables si es necesario.
2. Ejecuta:

```bat
docker-compose up --build
```

Esto levantará MySQL y el servicio `backend` en `http://localhost:3001`.

# Logging

Los logs ahora se emiten por consola y también se guardan en `logs/app-YYYY-MM-DD.log` con rotación diaria. Puedes ajustar la retención con la variable `LOG_MAX_FILES` en `backend/.env`.

# MiOtraCreacion

Pequeña app que guarda datos personales (nombre, email, edad, teléfono) y genera un informe CSV.

Estructura principal:
- `web/` — frontend (HTML/CSS/JS)
- `backend/` — servidor Node.js + MySQL

Requisitos
- Node.js 18+ (probado con Node 22)
- MySQL/MariaDB accesible (puede ser remoto)

Configuración rápida
1. Copia ejemplo de variables de entorno:

```bash
cd backend
copy .env.example .env   # Windows (o cp .env.example .env en Linux/Mac)
```

2. Edita `backend/.env` y completa las credenciales:
```
DB_HOST=...
DB_USER=...
DB_PASS=...
DB_NAME=...
DB_PORT=3306
API_KEY=tu_api_key_aqui
PORT=3001
```

3. Instala dependencias e inicia backend:

```bash
cd backend
npm install
npm run start
```

4. Abre `web/index.html` en el navegador (archivo local) para usar la UI.

Uso de API key
- Si configuras `API_KEY` en `.env`, las peticiones que modifican datos (POST, PUT, DELETE) requieren incluir la cabecera `x-api-key: <API_KEY>`.
- La UI incluye un campo para introducir y almacenar la API key en `sessionStorage` (no guardar claves sensibles en repositorios).

Endpoints principales
- GET /api/test-db — prueba de conexión
- GET /api/usuarios?page=1&limit=20&q=texto — listado con paginación y búsqueda
- POST /api/usuarios — crear (JSON)
- PUT /api/usuarios/:id — actualizar (JSON)
- DELETE /api/usuarios/:id — eliminar
- GET /api/informe — descarga CSV

Siguientes mejoras sugeridas
- Agregar autenticación real (JWT), rate limiting y logging
- Despliegue con PM2 o contenedor Docker

Si quieres que haga el despliegue o agregue autenticación completa, dime y lo preparo.
