# Spora Backend (MVP)

Backend sencillo para el MVP de Spora, pensado para correr separado del frontend.

## Requisitos

- Node.js 18+
- MongoDB (segun indicas, en el puerto 8080)

## Setup

1. Copia el archivo de entorno:

```
cp .env.example .env
```

2. Instala dependencias:

```
npm install
```

3. Ejecuta en modo desarrollo:

```
npm run dev
```

## Endpoints principales

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/auth/me`
- `GET /api/floras`
- `GET /api/floras/:id`
- `POST /api/floras`
- `PATCH /api/floras/:id`
- `DELETE /api/floras/:id`
- `POST /api/reports`
- `GET /api/reports` (admin)
- `PATCH /api/reports/:id` (admin)
- `GET /api/admin/metrics` (admin)
- `GET /api/admin/usage` (admin)
- `GET /api/admin/users` (admin)
- `PATCH /api/admin/users/:id/role` (admin)
- `PATCH /api/admin/users/:id/status` (admin)
- `DELETE /api/admin/users/:id` (admin, soft delete)
- `GET /api/admin/flagged` (admin)

## Notas

- El rol "guest" se interpreta como usuario no autenticado.
- El campo `text` en floras es inmutable tras publicacion.
- Las acciones admin generan un registro en `adminLogs`.
