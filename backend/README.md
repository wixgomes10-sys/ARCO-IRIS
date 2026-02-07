# Arco-Íris Backend (Express + SQLite)

Instalação e execução rápida (Windows):

1. Abra terminal na pasta `backend`

```bash
cd "c:\\Users\\AREA DE TRABALHO\\Documents\\projeto faculdade\\backend"
npm install
```

2. Copie `.env.example` para `.env` e ajuste se quiser:

```bash
copy .env.example .env
```

3. Inicie o servidor:

```bash
npm start
```

O servidor expõe rotas em `http://localhost:3000/api/*`.

Principais endpoints de exemplo

- POST `/api/auth/login` { user, pass } → retorna `{ token, user }`
- POST `/api/auth/register` (admin) { nome, user, pass, nivel }
- GET `/api/usuarios` (admin)
- GET `/api/reservas` (auth)
- POST `/api/reservas` (auth)
- PUT `/api/reservas/:id` (auth)
- DELETE `/api/reservas/:id` (auth)

Como integrar no frontend (exemplos):

Login (substituir o uso de localStorage/sessionStorage atual):

```js
async function fazerLogin(user, pass) {
  const resp = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ user, pass })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erro');
  // salvar token e info do usuário
  sessionStorage.setItem('token', data.token);
  sessionStorage.setItem('sessao_usuario', JSON.stringify(data.user));
}
```

Criar reserva (usar token):

```js
async function criarReserva(dados) {
  const token = sessionStorage.getItem('token');
  const resp = await fetch('http://localhost:3000/api/reservas', {
    method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer '+token },
    body: JSON.stringify(dados)
  });
  return resp.json();
}
```

Buscar reservas:

```js
const token = sessionStorage.getItem('token');
const resp = await fetch('http://localhost:3000/api/reservas', { headers: { 'Authorization': 'Bearer '+token } });
const lista = await resp.json();
```

Observações
- Use `JWT_SECRET` forte em produção.
- SQLite guarda os dados em `backend/data.sqlite`.
- Para produção, considere usar MySQL/Postgres e HTTPS.
