-- Add the "search" target type so jobs can be created from a description
-- instead of a hand-supplied URL list.

ALTER TYPE "TargetType" ADD VALUE IF NOT EXISTS 'search';
