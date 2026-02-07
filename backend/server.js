require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { init, run, all, get } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mudar_senha_rapido';

app.use(cors());
app.use(express.json());

// Inicializa DB
init().catch(err => { console.error('Erro ao inicializar DB', err); process.exit(1); });

// Middleware de autenticação
function authenticate(req, res, next) {
  const h = req.headers['authorization'];
  if (!h) return res.status(401).json({ error: 'Token ausente' });
  const parts = h.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Formato inválido' });
  jwt.verify(parts[1], JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Token inválido' });
    req.user = payload;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.nivel !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  next();
}

// Auth - login
app.post('/api/auth/login', async (req, res) => {
  const { user, pass } = req.body;
  if (!user || !pass) return res.status(400).json({ error: 'user e pass são obrigatórios' });
  try {
    const row = await get('SELECT id, nome, user, pass_hash, nivel FROM usuarios WHERE user = ?', [user]);
    if (!row) return res.status(401).json({ error: 'Credenciais inválidas' });
    const ok = bcrypt.compareSync(pass, row.pass_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ id: row.id, user: row.user, nome: row.nome, nivel: row.nivel }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: row.id, user: row.user, nome: row.nome, nivel: row.nivel } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// Auth - criar usuário (admin)
app.post('/api/auth/register', authenticate, requireAdmin, async (req, res) => {
  const { nome, user, pass, nivel } = req.body;
  if (!nome || !user || !pass || !nivel) return res.status(400).json({ error: 'dados incompletos' });
  try {
    const hash = bcrypt.hashSync(pass, 10);
    await run('INSERT INTO usuarios (nome, user, pass_hash, nivel) VALUES (?, ?, ?, ?)', [nome, user, hash, nivel]);
    res.json({ success: true });
  } catch (err) {
    if (err && err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Usuário já existe' });
    console.error(err);
    res.status(500).json({ error: 'Erro ao cadastrar' });
  }
});

// GET usuario (admin)
app.get('/api/usuarios', authenticate, requireAdmin, async (req, res) => {
  try {
    const rows = await all('SELECT id, nome, user, nivel FROM usuarios');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro' });
  }
});

// Helper: detectar conflito de horários
async function temConflito(data, inicio, fim, esporte) {
  const conflitos = await all(
    'SELECT * FROM reservas WHERE esporte = ? AND data = ? AND ((inicio >= ? AND inicio < ?) OR (fim > ? AND fim <= ?) OR (inicio <= ? AND fim >= ?))',
    [esporte, data, inicio, fim, inicio, fim, inicio, fim]
  );
  return conflitos && conflitos.length > 0;
}

// Reservas CRUD
app.get('/api/reservas', authenticate, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM reservas ORDER BY data, inicio');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro' });
  }
});

app.post('/api/reservas', authenticate, async (req, res) => {
  const { nome, esporte, data, inicio, fim, valor, status } = req.body;
  if (!nome || !esporte || !data || !inicio || !fim || valor == null) return res.status(400).json({ error: 'dados incompletos' });
  
  // Validações
  if (inicio >= fim) return res.status(400).json({ error: 'Horário inválido: fim deve ser após início' });
  if (valor <= 0) return res.status(400).json({ error: 'Valor deve ser maior que zero' });
  
  try {
    // Verificar conflito
    const conf = await temConflito(data, inicio, fim, esporte);
    if (conf) return res.status(409).json({ error: `Conflito de horário detectado para ${esporte} nesta data` });
    
    await run('INSERT INTO reservas (nome, esporte, data, inicio, fim, valor, status, owner_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [nome, esporte, data, inicio, fim, valor, status || 'Pendente', req.user.user]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar reserva' });
  }
});

app.put('/api/reservas/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  const fields = req.body;
  // Permitir apenas atualização de campos específicos
  const allowed = ['status', 'nome', 'valor'];
  const updates = [];
  const params = [];
  for (const k of allowed) {
    if (k in fields) { updates.push(`${k} = ?`); params.push(fields[k]); }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nada para atualizar' });
  params.push(id);
  try {
    await run(`UPDATE reservas SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar' });
  }
});

app.delete('/api/reservas/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  try {
    await run('DELETE FROM reservas WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar' });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
