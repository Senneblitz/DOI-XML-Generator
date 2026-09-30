import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  markTaken,
  markTakenEntries,
  approveTaken,
  approveItem,
  reviewOf,
  itemReview,
  pendingTaken,
} from '../src/model/takeover.js';

const DOI = '10.21249/DZHW:nac2018-dmr-de:3.0.0';
const creator = (name) => ({ name, nameType: 'Personal' });

test('a taken-over field waits for its confirmation', () => {
  const model = { titles: [{ value: 'Titel', lang: 'de' }] };
  const taken = markTaken({}, ['titles'], DOI, model);
  assert.equal(reviewOf(taken, 'titles', model.titles).state, 'pending');
  assert.equal(reviewOf(taken, 'descriptions', []), null, 'untouched fields have no review');
  assert.deepEqual(pendingTaken(taken, model).map((r) => r.field), ['titles']);

  const approved = approveTaken(taken, 'titles');
  assert.equal(reviewOf(approved, 'titles', model.titles).state, 'approved');
  assert.deepEqual(pendingTaken(approved, model), []);
  assert.equal(reviewOf(taken, 'titles', model.titles).state, 'pending', 'the earlier state is left alone');
  assert.equal(approveTaken(approved, 'subjects'), approved, 'confirming an untouched field changes nothing');
});

test('working on a field settles its review', () => {
  const model = { publicationYear: '2025' };
  const taken = markTaken({}, ['publicationYear'], DOI, model);
  assert.equal(reviewOf(taken, 'publicationYear', '2025').state, 'pending');
  assert.equal(reviewOf(taken, 'publicationYear', '2026').state, 'edited', 'changed here, so it was looked at');
  assert.deepEqual(pendingTaken(taken, { publicationYear: '2026' }), []);
});

test('entries are confirmed one by one and follow their content, not their position', () => {
  const model = { creators: [creator('A, A'), creator('B, B'), creator('C, C')] };
  let taken = markTaken({}, ['creators'], DOI, model);
  assert.deepEqual(reviewOf(taken, 'creators', model.creators), { doi: DOI, state: 'pending', open: 3, total: 3 });
  assert.equal(itemReview(taken, 'creators', model.creators[0]), 'pending');

  taken = approveItem(taken, 'creators', model.creators[0]);
  assert.equal(itemReview(taken, 'creators', model.creators[0]), 'approved');
  assert.equal(reviewOf(taken, 'creators', model.creators).open, 2);

  // Reordering keeps the confirmation with the entry.
  const reordered = [model.creators[2], model.creators[0], model.creators[1]];
  assert.equal(itemReview(taken, 'creators', reordered[1]), 'approved');
  assert.equal(reviewOf(taken, 'creators', reordered).open, 2);

  // An edited or added entry is the person's own content.
  const edited = { ...model.creators[1], name: 'B, Berta' };
  assert.equal(itemReview(taken, 'creators', edited), 'own');
  assert.equal(itemReview(taken, 'creators', creator('Neu, N')), 'own');

  taken = approveItem(taken, 'creators', model.creators[1]);
  taken = approveItem(taken, 'creators', model.creators[2]);
  assert.equal(reviewOf(taken, 'creators', model.creators).state, 'approved');
  assert.deepEqual(pendingTaken(taken, model), []);
});

test('confirming the whole field covers all of its entries', () => {
  const model = { creators: [creator('A, A'), creator('B, B')] };
  const taken = approveTaken(markTaken({}, ['creators'], DOI, model), 'creators');
  assert.equal(reviewOf(taken, 'creators', model.creators).state, 'approved');
  assert.equal(itemReview(taken, 'creators', model.creators[1]), 'approved');
});

test('only the added entries of a field count as taken over', () => {
  const own = { value: 'Eigenes', subjectScheme: '' };
  const added = [{ value: 'Aus dem Paket', subjectScheme: 'TheSoz' }];
  const subjects = [own, ...added];
  const taken = markTakenEntries({}, 'subjects', DOI, subjects, added);
  assert.equal(itemReview(taken, 'subjects', own), 'own', 'what was there before needs no confirmation');
  assert.equal(itemReview(taken, 'subjects', added[0]), 'pending');
  assert.deepEqual(reviewOf(taken, 'subjects', subjects), { doi: DOI, state: 'pending', open: 1, total: 1 });
});

test('a second takeover revokes the confirmation and names the new source', () => {
  const other = '10.21249/DZHW:nac2018-dmr-en:3.0.0';
  const model = { titles: [{ value: 'Titel' }] };
  const taken = approveTaken(markTaken({}, ['titles'], DOI, model), 'titles');
  const again = markTaken(taken, ['titles'], other, model);
  assert.deepEqual(reviewOf(again, 'titles', model.titles), { doi: other, state: 'pending', open: 1, total: 1 });
});
