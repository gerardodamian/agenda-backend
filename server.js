// server.js
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Crear base de datos SQLite (persistente en Render)
const dbPath = path.join(__dirname, "agenda.db");
const db = new sqlite3.Database(dbPath);

// Crear tabla si no existe
db.run(`
  CREATE TABLE IF NOT EXISTS turnos (
    fecha TEXT,
    hora INTEGER,
    consultorio INTEGER,
    nombre TEXT,
    telefono TEXT,
    deposito INTEGER,
    montoDeposito TEXT,
    comentario TEXT,
    PRIMARY KEY (fecha, hora, consultorio)
  )
`);

// Ruta de prueba
app.get("/", (req, res) => {
    res.json({ status: "API de Agenda funcionando 🚀" });
});

// Obtener todos los turnos
app.get("/turnos", (req, res) => {
    db.all("SELECT * FROM turnos", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const datos = {};
        rows.forEach((row) => {
            if (!datos[row.fecha]) datos[row.fecha] = {};
            datos[row.fecha][`${row.hora}-${row.consultorio}`] = {
                nombre: row.nombre,
                telefono: row.telefono,
                deposito: !!row.deposito,
                montoDeposito: row.montoDeposito,
                comentario: row.comentario,
            };
        });
        res.json(datos);
    });
});

// Obtener turnos de una fecha
app.get("/turnos/:fecha", (req, res) => {
    const { fecha } = req.params;
    db.all("SELECT * FROM turnos WHERE fecha = ?", [fecha], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const datos = {};
        rows.forEach((row) => {
            datos[`${row.hora}-${row.consultorio}`] = {
                nombre: row.nombre,
                telefono: row.telefono,
                deposito: !!row.deposito,
                montoDeposito: row.montoDeposito,
                comentario: row.comentario,
            };
        });
        res.json(datos);
    });
});

// Guardar/actualizar un turno
app.post("/turnos/:fecha/:hora/:consultorio", (req, res) => {
    const { fecha, hora, consultorio } = req.params;
    const { nombre, telefono, deposito, montoDeposito, comentario } = req.body;

    db.run(
        `INSERT OR REPLACE INTO turnos 
    (fecha, hora, consultorio, nombre, telefono, deposito, montoDeposito, comentario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            fecha,
            parseInt(hora),
            parseInt(consultorio),
            nombre,
            telefono,
            deposito ? 1 : 0,
            montoDeposito,
            comentario,
        ],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Mantener vivo el servidor en Render (auto-ping cada 10 minutos)
if (process.env.RENDER === "true") {
    const axios = require("axios");
    const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    
    setInterval(() => {
        axios.get(BACKEND_URL)
            .then(() => console.log("🔄 Auto-ping enviado para mantener vivo el backend"))
            .catch(err => console.error("❌ Error en auto-ping:", err.message));
    }, 10 * 60 * 1000); // cada 10 minutos
}

// Obtener cantidad de turnos ocupados en un mes
app.get("/turnos-mes/:anio/:mes", (req, res) => {
    const { anio, mes } = req.params;
    const fechaInicio = `${anio}-${mes.padStart(2, "0")}-01`;
    const fechaFin = `${anio}-${mes.padStart(2, "0")}-31`; // simplificado

    db.all(
        "SELECT COUNT(*) as total FROM turnos WHERE fecha BETWEEN ? AND ? AND (nombre != '' OR telefono != '')",
        [fechaInicio, fechaFin],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ total: rows[0].total });
        }
    );
});

