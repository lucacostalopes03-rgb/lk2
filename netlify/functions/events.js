const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'djlk-events';
const BLOB_KEY = 'events.json';

function getEventsStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  // Si les identifiants manuels sont fournis, on les utilise (contourne les cas
  // où la détection automatique du contexte Netlify Blobs échoue).
  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }
  return getStore(STORE_NAME);
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

function todayStr() {
  // Date du jour en Europe/Zurich, format YYYY-MM-DD (comparable en texte)
  const now = new Date();
  const zurich = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Zurich' }));
  const y = zurich.getFullYear();
  const m = String(zurich.getMonth() + 1).padStart(2, '0');
  const d = String(zurich.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isAuthorized(event) {
  const provided = event.headers['x-admin-password'] || event.headers['X-Admin-Password'];
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { ok: false, reason: 'server' }; // ADMIN_PASSWORD manquante côté Netlify
  if (provided === undefined) return { ok: true, isAdmin: false }; // requête publique (site principal)
  if (provided === expected) return { ok: true, isAdmin: true };
  return { ok: false, reason: 'password' };
}

function getIdFromPath(event) {
  // Chemin réel: /.netlify/functions/events ou /.netlify/functions/events/<id>
  const parts = event.path.split('/').filter(Boolean);
  const idx = parts.indexOf('events');
  if (idx !== -1 && parts.length > idx + 1) {
    return decodeURIComponent(parts[idx + 1]);
  }
  return null;
}

async function readEvents(store) {
  const data = await store.get(BLOB_KEY, { type: 'json' });
  return Array.isArray(data) ? data : [];
}

async function writeEvents(store, events) {
  await store.setJSON(BLOB_KEY, events);
}

exports.handler = async (event) => {
  const store = getEventsStore();
  const method = event.httpMethod;
  const id = getIdFromPath(event);

  const auth = isAuthorized(event);
  if (!auth.ok) {
    if (auth.reason === 'server') {
      return json(500, { error: 'Serveur non configuré : variable ADMIN_PASSWORD manquante sur Netlify.' });
    }
    return json(401, { error: 'Mot de passe incorrect.' });
  }

  try {
    if (method === 'GET') {
      const events = await readEvents(store);
      const today = todayStr();
      const upcoming = events
        .filter((e) => e.date && e.date >= today)
        .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      return json(200, upcoming);
    }

    // Les écritures nécessitent d'être authentifié en tant qu'admin (mot de passe fourni et correct)
    if (!auth.isAdmin) {
      return json(401, { error: 'Mot de passe requis pour cette action.' });
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.title || !body.date) {
        return json(400, { error: "Le titre et la date sont obligatoires." });
      }
      const events = await readEvents(store);
      const newEvent = {
        id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
        title: body.title || '',
        date: body.date || '',
        time: body.time || '',
        venue: body.venue || '',
        location: body.location || '',
        status: body.status || 'Confirmé',
        link: body.link || '',
        image: body.image || '',
        description: body.description || '',
      };
      events.push(newEvent);
      await writeEvents(store, events);
      return json(201, newEvent);
    }

    if (method === 'PUT') {
      if (!id) return json(400, { error: 'Identifiant manquant.' });
      const events = await readEvents(store);
      const index = events.findIndex((e) => e.id === id);
      if (index === -1) return json(404, { error: 'Date introuvable.' });
      const body = JSON.parse(event.body || '{}');
      events[index] = { ...events[index], ...body, id };
      await writeEvents(store, events);
      return json(200, events[index]);
    }

    if (method === 'DELETE') {
      if (!id) return json(400, { error: 'Identifiant manquant.' });
      const events = await readEvents(store);
      const filtered = events.filter((e) => e.id !== id);
      if (filtered.length === events.length) return json(404, { error: 'Date introuvable.' });
      await writeEvents(store, filtered);
      return json(200, { deleted: true });
    }

    return json(405, { error: 'Méthode non autorisée.' });
  } catch (err) {
    return json(500, { error: 'Erreur serveur : ' + err.message });
  }
};
