Interact with the local Tracker app (running at http://localhost:3001) — fetch tickets, create new ones, or update existing ones.

The argument is: $ARGUMENTS

## Step 0 — API health check

Always start by checking the API is up:
```bash
curl -s http://localhost:3001/api/health
```
If it's down, tell the user to start the app with `docker compose up -d` from `/Users/josesalina/Documents/work/ticket-app/`.

---

## Decide the intent

Read `$ARGUMENTS` and decide which mode to use:

- **CREATE mode**: argument starts with words like "crear", "create", "nueva historia", "nuevo ticket", or contains "historias de usuario", "user stories" → go to **Section A (Create)**
- **FETCH mode**: otherwise (argument is a key like `PROJ-1`, an ID number, or a search term) → go to **Section B (Fetch)**

If unsure, ask the user once before proceeding.

---

## Section A — Create tickets

### Required body for POST /api/tickets

```json
{
  "project": "Finances",            // string with project NAME (existing or new)
                                     // OR alternatively: "project_id": 5
  "title": "...",                   // required, non-empty
  "description": "...",             // markdown allowed
  "priority": "low|medium|high|critical",
  "status": "todo|in_progress|review|done|backlog",  // defaults to "todo"
  "assignee": "Claude"              // optional
}
```

⚠️ **Important rules to avoid breaking the API:**
- Always send EITHER `project` (string with name) OR `project_id` (number). Never both.
- If using `project` as a string, it MUST be a non-empty trimmed string.
- Use the EXACT project name (e.g. `"Finances"`, `"Project-Template "` — note trailing space if any). Fetch `/api/projects` or `/api/tickets` first to confirm spelling.
- If the project doesn't exist, the API will create it (auto-generated 4-letter prefix from the name).

### Steps for creation

1. Fetch existing projects to get their IDs and exact names:
   ```bash
   curl -s http://localhost:3001/api/projects | python3 -c "import json,sys; [print(p['id'], p['name']) for p in json.load(sys.stdin)]"
   ```

2. Ask user for missing details if needed (project, priority, scope of stories).

3. Follow the **template format** used by existing tickets in the project — sections in this order:
   - `## Contexto`
   - `## Criterios de aceptación` (checklist with `- [ ]`)
   - `## Notas técnicas`

4. Create each ticket with its own POST. Run them in parallel when possible.
   - If the project **already exists**: use `project_id` (number) — never `project` string for existing projects.
   - If the project **does not exist yet**: use `project` (string with the desired name).
   ```bash
   # Existing project — use project_id
   curl -s -X POST http://localhost:3001/api/tickets \
     -H "Content-Type: application/json" \
     -d '{"project_id":3,"title":"...","priority":"high","description":"## Contexto\n..."}'

   # New project — use project name string
   curl -s -X POST http://localhost:3001/api/tickets \
     -H "Content-Type: application/json" \
     -d '{"project":"New Project","title":"...","priority":"high","description":"## Contexto\n..."}'
   ```

5. After creating all tickets, list back the keys assigned (e.g. `FINA-2`, `FINA-3`...) so the user can see them.

---

## Section B — Fetch ticket info

1. Determine the lookup strategy based on the argument:
   - If `$ARGUMENTS` looks like a ticket key (e.g. `PROJ-1`, `FINA-42`) **or** a pure number: fetch directly
     ```bash
     curl -s http://localhost:3001/api/tickets/$ARGUMENTS
     ```
     The API accepts both a key (`FINA-20`) and a numeric ID in the `:id` segment.
   - If `$ARGUMENTS` is a search term or partial title: fetch all tickets and find the best match by title or description
     ```bash
     curl -s http://localhost:3001/api/tickets
     ```

2. Once you have the ticket data, present it in this format:

   ---
   ## Ticket: {key} — {title}

   **Project:** {project}
   **Status:** {status}
   **Priority:** {priority}
   **Assignee:** {assignee}

   ### Description
   {description}

   ### Comments ({count})
   {list each comment with date}

   ### Work Log ({total hours}h total)
   {list each entry with hours and note}

   ---

3. Add a brief "Implementation Context" section summarizing what needs to be done based on the ticket's title, description, and any comments — so we're ready to start coding.

---

## Workflow reminder (from user CLAUDE.md)

When you finish working on a ticket, move it to the `review` column and add a comment summarizing the implementation.
Use the ticket KEY (e.g. `FINA-20`) directly — the API accepts both key and numeric ID:
```bash
# Update status
curl -s -X PUT http://localhost:3001/api/tickets/{key} \
  -H "Content-Type: application/json" \
  -d '{"status":"review"}'

# Add implementation comment
curl -s -X POST http://localhost:3001/api/tickets/{key}/comments \
  -H "Content-Type: application/json" \
  -d '{"text":"Implementación resumen: ..."}'
```