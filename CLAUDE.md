# ticket-app

Sistema de seguimiento de tickets estilo Jira, minimalista, con tema oscuro.

## Stack

- **Backend**: Node.js + Express (sin ORM, SQL puro con `pg`)
- **Base de datos**: PostgreSQL 16
- **Frontend**: Vanilla JS, SPA en un solo archivo HTML
- **Infraestructura**: Docker + Docker Compose

## Estructura

```
api/server.js        — API REST (Express)
db/init.sql          — Schema inicial de PostgreSQL
frontend/index.html  — SPA completa (CSS + JS inline)
docker-compose.yml   — Orquestación de contenedores
Dockerfile           — Imagen del servidor API
```

## Modelo de datos

- **projects** — nombre único, prefijo de 4 chars (ej. `PROJ`)
- **tickets** — key auto-generado (`PROJ-1`, `PROJ-2`…), status, priority, assignee, labels
- **comments** — pertenecen a un ticket, ON DELETE CASCADE
- **work_logs** — horas registradas por ticket, ON DELETE CASCADE

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tickets` | Lista tickets (filtros: `?project=` `?status=`) con comments y work_log incluidos |
| GET | `/api/tickets/:id` | Un ticket con comments y work_log |
| POST | `/api/tickets` | Crea ticket (crea el proyecto si no existe) |
| PUT | `/api/tickets/:id` | Actualiza campos del ticket |
| DELETE | `/api/tickets/:id` | Elimina ticket (cascade a comments y work_logs) |
| POST | `/api/tickets/:id/comments` | Agrega comentario |
| POST | `/api/tickets/:id/log` | Agrega work log |
| GET | `/api/projects` | Lista proyectos con conteo de tickets |
| GET | `/api/summary` | Conteo de tickets por status |
| GET | `/api/health` | Health check de DB |

## Notas técnicas

- Los comments y work_logs se obtienen via **subconsultas correlacionadas** (no JOINs) para evitar duplicación por producto cartesiano.
- El frontend actualiza un solo ticket en estado local al agregar comentarios (vía `GET /api/tickets/:id`), sin recargar toda la lista.
- No hay autenticación.
- La key del ticket se genera contando tickets existentes del proyecto al momento de creación.
