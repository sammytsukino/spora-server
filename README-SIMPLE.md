# Spora Backend - Versión Simplificada

## Estructura del Proyecto

```
spora-server/
├── index.js           # Servidor principal con todas las rutas
├── db.js             # Conexión a MongoDB
├── models/           # Modelos de Mongoose
│   ├── User.js
│   ├── Flora.js
│   ├── Report.js
│   └── AdminLog.js
├── .env              # Variables de entorno
├── package.json
└── postman_collection.json
```

## Instalación

```bash
npm install
```

## Configuración

Asegúrate de tener MongoDB corriendo (Docker o local) y configura tu `.env`:

```env
PORT=4000
MONGO_URL=mongodb://localhost:27017/sporadb
JWT_SECRET=change_this_secret
CORS_ORIGIN=http://localhost:5173
```

## Ejecutar

```bash
npm run dev
```

## Características

✅ Autenticación con JWT y bcrypt
✅ Roles de usuario (cultivator, admin)
✅ CRUD de Floras
✅ Sistema de reportes
✅ Panel de administración
✅ Todo en un solo archivo `index.js` (estilo clase)

## Rutas

### Auth
- `POST /api/auth/signup` - Registrar usuario
- `POST /api/auth/signin` - Iniciar sesión
- `GET /api/auth/me` - Info del usuario actual (requiere token)

### Floras
- `GET /api/floras` - Listar floras
- `GET /api/floras/:id` - Ver flora específica
- `POST /api/floras` - Crear flora (requiere token)
- `PATCH /api/floras/:id` - Actualizar flora (requiere token)
- `DELETE /api/floras/:id` - Eliminar flora (requiere token)

### Reports
- `POST /api/reports` - Crear reporte (requiere token)

### Admin (requiere rol admin)
- `GET /api/admin/metrics` - Métricas del sistema
- `GET /api/admin/usage` - Estadísticas de uso
- `GET /api/admin/users` - Listar usuarios
- `PATCH /api/admin/users/:id/role` - Cambiar rol
- `PATCH /api/admin/users/:id/status` - Cambiar estado
- `DELETE /api/admin/users/:id` - Eliminar usuario (soft delete)
- `GET /api/admin/reports` - Ver reportes
- `PATCH /api/admin/reports/:id` - Actualizar reporte
- `GET /api/admin/flagged` - Ver floras reportadas
- `PATCH /api/admin/floras/:id/status` - Moderar flora

## Testing con Postman

Importa `postman_collection.json` en Postman. Los tokens se gestionan automáticamente:

1. Ejecuta **Sign In** 
2. El token se guarda automáticamente
3. Los demás endpoints lo usan sin configuración adicional
