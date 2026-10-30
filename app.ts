import { app } from 'mu';
import qs from 'qs';

import express, { Request, ErrorRequestHandler } from 'express';
import bodyParser from 'body-parser';
import config from './config/config';
import { getTargetCount, getTargets } from './controllers/annotation-target';
import {
  getAnnotationCountForTarget,
  getAnnotationsForTarget,
  getAllAnnotationCountForTarget,
  getAllAnnotationsForTarget,
  enrichAnnotationsWithRdfsComments,
} from './controllers/annotations';
import {
  getReviewSummary,
  getReviewTotals,
  getConceptDecisionCounts,
} from './controllers/review-summary';
import {
  deleteAnnotationReview,
  reviewAnnotationTarget,
} from './controllers/review';
import { Correction, Filters } from './types';
import { optionsRouter } from './routers/options';

// we want filter[foo]=bar&filter[id]=1
app.set('query parser', (str: string) => qs.parse(str, { depth: 10 }));

app.use(
  bodyParser.json({
    limit: '500mb',
    // @ts-expect-error ts wants more complex typing here but it really doesn't matter for our case
    type: function (req: Request) {
      return /^application\/json/.test(req.get('content-type') as string);
    },
  }),
);

app.use(express.urlencoded({ extended: true }));

// language tag used to pick one label per concept, e.g. "nl"
function requestLanguage(req: Request) {
  const language = req.query.language;
  return typeof language === 'string'
    ? language.toLowerCase().split('-')[0]
    : '';
}

app.get('/health', async (_req, res) => {
  res.send({ status: 'ok' });
});

app.use('/options', optionsRouter);

app.get('/targets/:type', async (req, res) => {
  const type = req.params.type;
  const filters = req.query.filter as unknown as Filters;

  const target = config.targets[type];
  if (!target) {
    res.status(404).send({ error: `Unknown target type ${type}` });
    return;
  }
  const page = parseInt(req.query.page as string) || 0;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  const [count, targets] = await Promise.all([
    getTargetCount(target, filters),
    getTargets(target, filters, page, pageSize),
  ]);

  res.send({ targets, count });
});

app.get('/review-summary/:type', async (req, res) => {
  const target = config.targets[req.params.type];
  if (!target) {
    res.status(404).send({ error: `Unknown target type ${req.params.type}` });
    return;
  }
  const filters = req.query.filter as unknown as Filters;
  const [rows, totals, concepts] = await Promise.all([
    getReviewSummary(target, filters),
    getReviewTotals(target, filters),
    getConceptDecisionCounts(target, filters),
  ]);
  res.send({ rows, totals, concepts });
});

app.get('/annotations/:type/:id', async (req, res) => {
  const type = req.params.type;
  const id = req.params.id;
  const sessionId = req.get('mu-session-id') as string;
  const filters = req.query.filter as unknown as Filters;

  const target = config.targets[type];
  if (!target) {
    res.status(404).send({ error: `Unknown target type ${type}` });
    return;
  }
  const page = parseInt(req.query.page as string) || 0;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  const [annotationCount, annotations] = await Promise.all([
    getAnnotationCountForTarget(sessionId, target, id, filters),
    getAnnotationsForTarget(
      sessionId,
      target,
      id,
      filters,
      page,
      pageSize,
      requestLanguage(req),
    ),
  ]);

  const enrichedAnnotations = await enrichAnnotationsWithRdfsComments(
    annotations.annotations,
  );

  res.send({
    target: annotations.target,
    annotations: enrichedAnnotations,
    annotationCount,
  });
});

app.get('/annotations/:type', async (req, res) => {
  const type = req.params.type;
  const sessionId = req.get('mu-session-id') as string;

  const filters = req.query.filter as unknown as Filters;

  const target = config.targets[type];
  if (!target) {
    res.status(404).send({ error: `Unknown target type ${type}` });
    return;
  }
  const page = parseInt(req.query.page as string) || 0;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  const [annotationCount, annotations] = await Promise.all([
    getAllAnnotationCountForTarget(sessionId, target, filters),
    getAllAnnotationsForTarget(
      sessionId,
      target,
      filters,
      page,
      pageSize,
      requestLanguage(req),
    ),
  ]);
  const enrichedAnnotations = await enrichAnnotationsWithRdfsComments(
    annotations.annotations,
  );

  res.send({
    target: annotations.target,
    annotations: enrichedAnnotations,
    annotationCount,
  });
});

app.delete('/review/:annotationTargetId', async (req, res) => {
  const annotationTargetId = req.params.annotationTargetId;
  const sessionId = req.get('mu-session-id') as string;
  const currentCounts = await deleteAnnotationReview(
    annotationTargetId,
    sessionId,
  );
  res.send({ counts: currentCounts });
});

app.post('/review/:annotationTargetId/:result', async (req, res) => {
  const result = req.params.result as 'approve' | 'reject';
  const annotationTargetId = req.params.annotationTargetId;
  const sessionId = req.get('mu-session-id') as string;
  const corrections = req.body?.corrections as Correction[] | undefined;

  if (!['approve', 'reject'].includes(result)) {
    res.status(400).send({ error: `Unknown review result ${result}` });
    return;
  }
  // split up to help type checking along
  if (result === 'approve') {
    if (corrections) {
      res.status(400).send({
        error: 'Received an approval and a correction at the same time.',
      });
      return;
    } else {
      const { counts } = await reviewAnnotationTarget({
        annotationTargetId,
        sessionId,
        result,
        corrections,
      });
      res.send({ counts });
    }
  } else {
    const { counts, correctionIds } = await reviewAnnotationTarget({
      annotationTargetId,
      sessionId,
      result,
      corrections,
    });
    res.send({ counts, correctionIds });
  }
});

const errorHandler: ErrorRequestHandler = function (err, _req, res, _next) {
  // custom error handler to have a default 500 error code instead of 400 as in the template
  res.status(err.status || 500);
  res.json({
    errors: [{ title: err.message, description: err.description?.join('\n') }],
  });
};

app.use(errorHandler);
