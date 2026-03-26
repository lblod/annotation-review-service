import { app } from 'mu';

import express, { Request, ErrorRequestHandler } from 'express';
import bodyParser from 'body-parser';
import config from './config/config';
import { getTargetCount, getTargets } from './controllers/annotation-target';
import {
  getAnnotationCountForTarget,
  getAnnotationsForTarget,
} from './controllers/annotations';
import { reviewAnnotation } from './controllers/review';

app.use(
  bodyParser.json({
    limit: '500mb',
    type: function (req: Request) {
      return /^application\/json/.test(req.get('content-type') as string);
    },
  }),
);

app.use(express.urlencoded({ extended: true }));

app.get('/health', async (_req, res) => {
  res.send({ status: 'ok' });
});

app.get('/targets/:type', async (req, res) => {
  const type = req.params.type;

  const target = config.targets[type];
  if (!target) {
    res.status(404).send({ error: `Unknown target type ${type}` });
    return;
  }
  const page = parseInt(req.query.page as string) || 0;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  const [count, targets] = await Promise.all([
    getTargetCount(target, {}),
    getTargets(target, {}, page, pageSize),
  ]);

  res.send({ targets, count });
});

app.get('/annotations/:type/:id', async (req, res) => {
  const type = req.params.type;
  const id = req.params.id;
  const sessionId = req.get('mu-session-id') as string;

  const target = config.targets[type];
  if (!target) {
    res.status(404).send({ error: `Unknown target type ${type}` });
    return;
  }
  const page = parseInt(req.query.page as string) || 0;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  const [annotationCount, annotations] = await Promise.all([
    getAnnotationCountForTarget(target, id),
    getAnnotationsForTarget(sessionId, target, id, page, pageSize),
  ]);

  res.send({ ...annotations, annotationCount });
});

app.post('/review/:annotationId/:result', async (req, res) => {
  const result = req.params.result;
  const annotationId = req.params.annotationId;
  const sessionId = req.get('mu-session-id') as string;

  if (['approve', 'reject'].indexOf(result) < 0) {
    res.status(400).send({ error: `Unknown review result ${result}` });
    return;
  }
  const currentCounts = await reviewAnnotation(
    annotationId,
    sessionId,
    result as 'approve' | 'reject',
  );
  res.send(currentCounts);
});

const errorHandler: ErrorRequestHandler = function (err, _req, res, _next) {
  // custom error handler to have a default 500 error code instead of 400 as in the template
  res.status(err.status || 500);
  res.json({
    errors: [{ title: err.message, description: err.description?.join('\n') }],
  });
};

app.use(errorHandler);
