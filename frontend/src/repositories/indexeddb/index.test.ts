import 'fake-indexeddb/auto';
import { runLessonRepositoryContract } from '../contract.test-utils';
import { IndexedDbLessonRepository } from './index';

let dbCounter = 0;

runLessonRepositoryContract('IndexedDB', () => {
  dbCounter += 1;
  return new IndexedDbLessonRepository(`leviz-test-${dbCounter}-${Date.now()}`);
});
