import { Router } from 'express';

const router = Router();
const WIKI_API = 'https://en.wikipedia.org/w/api.php';

/**
 * GET /api/image?q=dog
 * Returns a thumbnail image URL for the given search term (e.g. guessed answer).
 * Uses Wikipedia API - no API key required. Works for any topic (animals, places, things, etc.).
 */
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q (search query)' });

    const searchUrl = new URL(WIKI_API);
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', q);
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');

    const headers = { 'User-Agent': 'MindGame/1.0 (Educational guessing game)' };
    const searchRes = await fetch(searchUrl.toString(), { headers });
    const searchData = await searchRes.json();
    const first = searchData?.query?.search?.[0];
    if (!first?.title) {
      return res.status(404).json({ error: 'No result', url: null });
    }

    const thumbUrl = new URL(WIKI_API);
    thumbUrl.searchParams.set('action', 'query');
    thumbUrl.searchParams.set('titles', first.title);
    thumbUrl.searchParams.set('prop', 'pageimages');
    thumbUrl.searchParams.set('pithumbsize', '400');
    thumbUrl.searchParams.set('format', 'json');
    thumbUrl.searchParams.set('origin', '*');

    const thumbRes = await fetch(thumbUrl.toString(), { headers });
    const thumbData = await thumbRes.json();
    const pages = thumbData?.query?.pages || {};
    const page = Object.values(pages)[0];
    const url = page?.thumbnail?.source || null;

    if (!url) return res.status(404).json({ error: 'No image', url: null });
    res.json({ url });
  } catch (err) {
    console.error('Image fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch image', url: null });
  }
});

export default router;
