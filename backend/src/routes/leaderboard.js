import { Router } from 'express';
import { getLeaderboard } from '../data/leaderboard.js';

const router = Router();

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const entries = getLeaderboard(limit);
  res.json({ leaderboard: entries });
});

export default router;
