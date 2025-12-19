#!/bin/bash

# Fix lines 440-445 (duplicate similar errors)
sed -i '440s/JSON.parse(dbJob.target_cluster_ids)/JSON.parse(dbJob.target_cluster_ids as string)/' isoSyncController.ts
sed -i '441s/status: dbJob.status,/status: (dbJob.status || "pending") as "pending" | "in_progress" | "completed" | "failed",/' isoSyncController.ts
sed -i '442s/progress: dbJob.progress,/progress: dbJob.progress || 0,/' isoSyncController.ts
sed -i '443s/JSON.parse(dbJob.results || '\''['\'']/JSON.parse((dbJob.results as string) || '\''[]'\'')/' isoSyncController.ts
sed -i '444s/completedAt: dbJob.completed_at,/completedAt: dbJob.completed_at || undefined,/' isoSyncController.ts
sed -i '445s/error: dbJob.error$/error: dbJob.error || undefined/' isoSyncController.ts

echo 'ISO controller fixes part 2 applied'
