const express = require('express');
const { createBasicAuth } = require('../auth/basic');
const { createProfileRepository } = require('./repository');
const { hashPassword } = require('./passwords');
const { HttpError, profileInput, cardLast4, username } = require('./validation');

function createProfilesRouter(repository = createProfileRepository()) {
  const router = express.Router();
  const authenticate = createBasicAuth(repository, 'Profile Management');
  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    next();
  });
  router.use(express.json({ limit: '16kb', strict: true }));

  async function ownProfile(req, res, next) {
    const target = username(req.params.username);
    const profile = await repository.get(target);
    if (!profile) throw new HttpError(404, 'User not found.');
    if (profile.id !== req.account.id) throw new HttpError(403, 'You can access only your own profile.');
    req.profile = profile;
    next();
  }

  router.post('/', async (req, res) => {
    const { password, ...data } = profileInput(req.body);
    data.passwordHash = await hashPassword(password);
    const user = await repository.create(data);
    res.location(`/users/${encodeURIComponent(user.username)}`).status(201).end();
  });

  router.get('/:username', authenticate, ownProfile, (req, res) => res.json(req.profile));

  router.patch('/:username', authenticate, ownProfile, async (req, res) => {
    const { password, ...data } = profileInput(req.body, true);
    if (password !== undefined) data.passwordHash = await hashPassword(password);
    await repository.update(req.account.id, data);
    res.status(204).end();
  });

  router.post('/:username/credit-cards', authenticate, ownProfile, async (req, res) => {
    const last4 = cardLast4(req.body);
    await repository.addCard(req.account.id, last4);
    res.status(201).end();
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2002') return res.status(409).json({ error: 'That username is already taken.' });
    if (error.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must be valid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    if (error.status === 415) return res.status(415).json({ error: 'Unsupported request encoding.' });
    if (error instanceof URIError) return res.status(400).json({ error: 'Invalid URL encoding.' });
    console.error('A profile operation failed. Check the database configuration.');
    res.status(500).json({ error: 'Unable to complete the request.' });
  });
  return router;
}

module.exports = { createProfilesRouter };
