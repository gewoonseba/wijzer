import { defineSchema, defineTable } from 'convex/server';
import { clipFields } from './validators';

export default defineSchema({
  clips: defineTable(clipFields)
    .index('by_createdAt', ['createdAt'])
    .index('by_publicId', ['publicId']),
});
