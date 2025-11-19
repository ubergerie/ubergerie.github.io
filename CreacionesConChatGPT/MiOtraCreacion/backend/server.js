// Load environment variables
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const { check, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Apply a basic rate limiter to all requests
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 60, // limit per minute
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Simple API key middleware (protect write operations)
const apiKey = process.env.API_KEY || '';
function requireApiKey(req, res, next) {
    // allow safe GETs without key
    if (req.method === 'GET') return next();
    const key = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) return next(); // if no key configured, skip
    if (!key || key !== apiKey) return res.status(401).json({ error: 'API key missing or invalid' });
    next();
}
app.use(requireApiKey);
// Ruta para probar la conexión a la base de datos
app.get('/api/test-db', (req, res) => {
    db.query('SELECT 1 + 1 AS resultado', (err, results) => {
        if (err) {
            res.status(500).json({ ok: false, error: err.message });
        } else {
            res.json({ ok: true, resultado: results[0].resultado });
        }
    });
});


// Configuración de conexión MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'test',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: process.env.DB_CONN_LIMIT ? Number(process.env.DB_CONN_LIMIT) : 10,
    queueLimit: 0
});

// Crear tabla si no existe
db.query(`
CREATE TABLE IF NOT EXISTS usuarios (
    id INT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100),
    email VARCHAR(100),
    edad INT,
    telefono VARCHAR(30),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`, (err) => {
    if (err) {
        logger.error('Error al crear la tabla usuarios: %s', err.message);
    } else {
        // Verificar si la columna telefono existe
        db.query("SHOW COLUMNS FROM usuarios LIKE 'telefono'", (err2, results) => {
            if (err2) {
                logger.error('Error al verificar columna telefono: %s', err2.message);
            } else if (results.length === 0) {
                // Si no existe, agregarla
                db.query('ALTER TABLE usuarios ADD COLUMN telefono VARCHAR(30)', (err3) => {
                    if (err3) {
                        logger.error('Error al agregar columna telefono: %s', err3.message);
                    } else {
                        logger.info('Columna telefono agregada correctamente.');
                    }
                });
            } else {
                logger.info('Columna telefono ya existe.');
            }
        });
    }
});


// Guardar datos personales
app.post('/api/usuarios',
  [
    check('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
    check('email').isEmail().withMessage('Email inválido'),
    check('edad').optional().isInt({ min: 0 }).withMessage('Edad debe ser número positivo'),
    check('telefono').optional().isLength({ max: 30 }).withMessage('Teléfono demasiado largo')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { nombre, email, edad, telefono } = req.body;
    db.query('INSERT INTO usuarios (nombre, email, edad, telefono) VALUES (?, ?, ?, ?)', [nombre, email, edad || null, telefono || null], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ id: result.insertId, nombre, email, edad, telefono });
        }
    });
});


// Obtener todos los usuarios con paginación y búsqueda
app.get('/api/usuarios', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const q = req.query.q ? `%${req.query.q}%` : null;
    const offset = (page - 1) * limit;
    let baseQuery = 'SELECT * FROM usuarios';
    let params = [];
    if (q) {
        baseQuery += ' WHERE nombre LIKE ? OR email LIKE ?';
        params.push(q, q);
    }
    baseQuery += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    db.query(baseQuery, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
        // also return total count
        let countQuery = 'SELECT COUNT(*) as total FROM usuarios';
        let countParams = [];
        if (q) {
            countQuery += ' WHERE nombre LIKE ? OR email LIKE ?';
            countParams.push(q, q);
        }
        db.query(countQuery, countParams, (err2, countRes) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const total = countRes[0].total || 0;
            res.json({ page, limit, total, data: rows });
        });
    });
});


// Endpoint para emitir informe (CSV)
app.get('/api/informe', (req, res) => {
    db.query('SELECT * FROM usuarios', (err, rows) => {
        if (err) {
            res.status(500).send('Error al generar el informe');
        } else {
            let csv = 'id,nombre,email,edad,telefono\n';
            csv += rows.map(u => `${u.id},${u.nombre},${u.email},${u.edad},${u.telefono || ''}`).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="informe_usuarios.csv"');
            res.send(csv);
        }
    });
});


// Eliminar usuario por id
app.delete('/api/usuarios/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM usuarios WHERE id = ?', [id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Usuario no encontrado' });
        } else {
            res.json({ ok: true, id });
        }
    });
});

// Modificar usuario por id
app.put('/api/usuarios/:id',
  [
    check('nombre').trim().notEmpty().withMessage('Nombre es requerido'),
    check('email').isEmail().withMessage('Email inválido'),
    check('edad').optional().isInt({ min: 0 }).withMessage('Edad debe ser número positivo'),
    check('telefono').optional().isLength({ max: 30 }).withMessage('Teléfono demasiado largo')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const id = req.params.id;
    const { nombre, email, edad, telefono } = req.body;
    db.query('UPDATE usuarios SET nombre = ?, email = ?, edad = ?, telefono = ? WHERE id = ?', [nombre, email, edad || null, telefono || null, id], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (result.affectedRows === 0) {
            res.status(404).json({ error: 'Usuario no encontrado' });
        } else {
            res.json({ ok: true, id });
        }
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Servidor backend escuchando en http://localhost:${PORT}`);
    });
}

// Export app and a close function for tests to cleanly shut down DB pool
module.exports = app;
module.exports.close = () => new Promise((resolve, reject) => {
    try {
        if (!db || !db.end) return resolve();
        db.end(err => {
            if (err) return reject(err);
            resolve();
        });
    } catch (e) {
        reject(e);
    }
});
