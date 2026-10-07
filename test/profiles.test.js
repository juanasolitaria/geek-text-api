const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const { createProfilesRouter } = require('../src/profiles/routes');
const { createProfileRepository } = require('../src/profiles/repository');
const { verifyPassword } = require('../src/profiles/passwords');

const profile = {
  username: 'torin_test', password: 'DemoPass123!', name: 'Torin Test',
  email: 'torin@example.com', homeAddress: '100 Example Lane',
};

// A small Prisma substitute lets the real repository and HTTP routes run
// without Supabase credentials. These tests do not verify a live database.
function createFakePrisma() {
  const users = [];
  const cards = [];
  function select(record, fields) {
    if (!record) return null;
    return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key,
      key === 'creditCards'
        ? cards.filter(card => card.userId === record.id).map(card => select(card, value.select))
        : record[key],
    ]));
  }
  function unique(username, exceptId) {
    if (users.some(user => user.username === username && user.id !== exceptId)) {
      throw Object.assign(new Error('Duplicate username'), { code: 'P2002' });
    }
  }
  return {
    users, cards,
    user: {
      async create({ data, select: fields }) {
        unique(data.username);
        const user = { id: String(users.length + 1), name: null, email: null,
          homeAddress: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        users.push(user);
        return select(user, fields);
      },
      async findUnique({ where, select: fields }) {
        return select(users.find(user => user.username === where.username), fields);
      },
      async update({ where, data, select: fields }) {
        const user = users.find(user => user.id === where.id);
        if (!user) throw Object.assign(new Error('Missing user'), { code: 'P2025' });
        if (data.username) unique(data.username, user.id);
        Object.assign(user, data);
        return select(user, fields);
      },
    },
    creditCard: {
      async create({ data, select: fields }) {
        const card = { id: String(cards.length + 1), createdAt: new Date(), ...data };
        cards.push(card);
        return select(card, fields);
      },
    },
  };
}

async function withApi(run) {
  const prisma = createFakePrisma();
  const app = express();
  app.use('/users', createProfilesRouter(createProfileRepository(prisma)));
  // A teammate's route must still be reachable after the Profile router.
  app.get('/users/:userId/wishlist', (req, res) => res.json([]));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(method, route, body, credentials) {
    const headers = { 'Content-Type': 'application/json' };
    if (credentials) headers.Authorization = 'Basic ' + Buffer.from(credentials).toString('base64');
    return fetch(base + route, { method, headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  try { await run({ prisma, request, base }); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const auth = `${profile.username}:${profile.password}`;
const userPath = `/users/${profile.username}`;
async function create(request, data = profile) {
  const response = await request('POST', '/users', data);
  assert.equal(response.status, 201);
  return response;
}

test('creates a profile with a Location header, empty body, and a hashed password', async () => {
  await withApi(async ({ request, prisma }) => {
    const response = await create(request);
    assert.equal(response.headers.get('location'), userPath);
    assert.equal(await response.text(), '');
    assert.equal(Object.hasOwn(prisma.users[0], 'password'), false);
    assert.notEqual(prisma.users[0].passwordHash, profile.password);
    assert.equal(await verifyPassword(profile.password, prisma.users[0].passwordHash), true);
    assert.equal(await verifyPassword('wrong-password', prisma.users[0].passwordHash), false);
  });
});

test('retrieves a saved profile without returning a password or hash', async () => {
  await withApi(async ({ request }) => {
    await create(request);
    const response = await request('GET', userPath, undefined, auth);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.username, profile.username);
    assert.equal(body.homeAddress, profile.homeAddress);
    assert.equal(Object.hasOwn(body, 'password'), false);
    assert.equal(Object.hasOwn(body, 'passwordHash'), false);
  });
});

test('updates an address with 204 and returns the changed address on GET', async () => {
  await withApi(async ({ request }) => {
    await create(request);
    const response = await request('PATCH', userPath, { homeAddress: '200 Example Avenue' }, auth);
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    const saved = await request('GET', userPath, undefined, auth);
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).homeAddress, '200 Example Avenue');
  });
});

test('rejects an email change without updating other submitted fields', async () => {
  await withApi(async ({ request }) => {
    await create(request);
    const response = await request('PATCH', userPath, { email: 'new@example.com', name: 'Changed' }, auth);
    assert.equal(response.status, 400);
    const saved = await (await request('GET', userPath, undefined, auth)).json();
    assert.equal(saved.email, profile.email);
    assert.equal(saved.name, profile.name);
  });
});

test('saves only the last four card digits and retrieves the card summary', async () => {
  await withApi(async ({ request, prisma }) => {
    await create(request);
    const response = await request('POST', userPath + '/credit-cards', { cardNumber: '4242424242424242' }, auth);
    assert.equal(response.status, 201);
    assert.equal(await response.text(), '');
    assert.equal(prisma.cards[0].last4, '4242');
    assert.deepEqual(Object.keys(prisma.cards[0]).sort(), ['createdAt', 'id', 'last4', 'userId']);
    const saved = await (await request('GET', userPath, undefined, auth)).json();
    assert.equal(saved.creditCards[0].last4, '4242');
    assert.equal(JSON.stringify(saved).includes('4242424242424242'), false);
  });
});

test('rejects duplicate usernames with 409', async () => {
  await withApi(async ({ request, prisma }) => {
    await create(request);
    assert.equal((await request('POST', '/users', profile)).status, 409);
    assert.equal(prisma.users.length, 1);
  });
});

test('rejects an invalid card without saving it', async () => {
  await withApi(async ({ request, prisma }) => {
    await create(request);
    assert.equal((await request('POST', userPath + '/credit-cards', { cardNumber: '4242424242424241' }, auth)).status, 400);
    assert.equal(prisma.cards.length, 0);
  });
});

test('requires valid credentials on GET, PATCH, and card creation', async () => {
  await withApi(async ({ request }) => {
    await create(request);
    for (const [method, route, body] of [
      ['GET', userPath, undefined], ['PATCH', userPath, { name: 'Changed' }],
      ['POST', userPath + '/credit-cards', { cardNumber: '4242424242424242' }],
    ]) {
      for (const credentials of [undefined, `${profile.username}:wrong-password`]) {
        const response = await request(method, route, body, credentials);
        assert.equal(response.status, 401);
        assert.match(response.headers.get('www-authenticate'), /^Basic /);
      }
    }
  });
});

test('blocks access to another account on every protected operation', async () => {
  await withApi(async ({ request }) => {
    await create(request);
    await create(request, { ...profile, username: 'another_user' });
    for (const [method, suffix, body] of [
      ['GET', '', undefined], ['PATCH', '', { name: 'Changed' }],
      ['POST', '/credit-cards', { cardNumber: '4242424242424242' }],
    ]) {
      assert.equal((await request(method, '/users/another_user' + suffix, body, auth)).status, 403);
    }
  });
});

test('supports changing username and password and rejects the old credentials', async () => {
  await withApi(async ({ request }) => {
    await create(request);
    assert.equal((await request('PATCH', userPath, { username: 'renamed_user', password: 'NewPass123!' }, auth)).status, 204);
    assert.equal((await request('GET', '/users/renamed_user', undefined, auth)).status, 401);
    assert.equal((await request('GET', '/users/renamed_user', undefined, 'renamed_user:DemoPass123!')).status, 401);
    assert.equal((await request('GET', '/users/renamed_user', undefined, 'renamed_user:NewPass123!')).status, 200);
  });
});

test('rejects missing required fields and malformed JSON', async () => {
  await withApi(async ({ request, base, prisma }) => {
    assert.equal((await request('POST', '/users', { username: 'missing_password' })).status, 400);
    const response = await fetch(base + '/users', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: '{broken' });
    assert.equal(response.status, 400);
    assert.equal(prisma.users.length, 0);
  });
});

test('allows other feature routes under /users to reach the next router', async () => {
  await withApi(async ({ request }) => {
    const response = await request('GET', '/users/sample_user/wishlist');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  });
});
