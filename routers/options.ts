import Router, { Request, Response } from 'express';
import {
  fetchExpressionPredicates,
  fetchAiModels,
  fetchValueTypes,
} from '../controllers/options';
import { KeyValuePair } from '../types';
import config from '../config/config';

export const optionsRouter = Router();

optionsRouter.get('/predicates', async (req: Request, res: Response) => {
  const keyValues: Array<KeyValuePair> = await fetchExpressionPredicates();
  res.send(keyValues);
});

optionsRouter.get('/ai-models', async (req: Request, res: Response) => {
  const keyValues: Array<KeyValuePair> = await fetchAiModels();
  res.send(keyValues);
});

optionsRouter.get('/value-types', async (req: Request, res: Response) => {
  const keyValues: Array<KeyValuePair> = await fetchValueTypes();
  res.send(keyValues);
});
