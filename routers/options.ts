import Router, { Request, Response } from 'express';
import { fetchExpressionPredicates } from '../controllers/options';
import { KeyValuePair } from '../types';

export const optionsRouter = Router();

optionsRouter.get('/predicates', async (req: Request, res: Response) => {
  const keyValues: Array<KeyValuePair> = await fetchExpressionPredicates();
  res.send(keyValues);
});
