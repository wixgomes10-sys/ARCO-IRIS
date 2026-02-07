const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data.sqlite');

const exists = fs.existsSync(DB_PATH);
const db = new sqlite3.Database(DB_PATH);

function run(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function all(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

async function init() {
  // Criar tabelas básicas se não existirem
  await run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    user TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    nivel TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    esporte TEXT NOT NULL,
    data TEXT NOT NULL,
    inicio TEXT NOT NULL,
    fim TEXT NOT NULL,
    valor REAL NOT NULL,
    status TEXT NOT NULL,
    owner_user TEXT
  )`);

  // Seed usuários padrão somente na primeira execução
  const admin = await get('SELECT * FROM usuarios WHERE user = ?', ['admin']);
  if (!admin) {
    const adminHash = bcrypt.hashSync('admin', 10);
    const funcHash = bcrypt.hashSync('123', 10);
    await run('INSERT INTO usuarios (nome, user, pass_hash, nivel) VALUES (?, ?, ?, ?)', ['Administrador', 'admin', adminHash, 'admin']);
    await run('INSERT INTO usuarios (nome, user, pass_hash, nivel) VALUES (?, ?, ?, ?)', ['Funcionário', 'func', funcHash, 'funcionario']);
    console.log('Usuários iniciais criados: admin / func');
  }
}

module.exports = { db, run, all, get, init };
