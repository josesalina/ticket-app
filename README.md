# Ticket Tracker

## Setup (un solo comando)

```bash
cd ticket-app
docker-compose up -d
```

Abrí **http://localhost:3001** y listo.

## API Endpoints

| Method | Path | Descripción |
|--------|------|-------------|
| GET | /api/tickets | Listar tickets |
| POST | /api/tickets | Crear ticket |
| PUT | /api/tickets/:id | Actualizar ticket |
| DELETE | /api/tickets/:id | Eliminar ticket |
| POST | /api/tickets/:id/comments | Agregar comentario |
| GET | /api/projects | Listar proyectos |
| GET | /api/summary | Resumen por estado |

## Parar

```bash
docker-compose down        # mantiene datos
docker-compose down -v     # borra datos
```

# Rebuild

```bash
docker compose up -d --build api
```