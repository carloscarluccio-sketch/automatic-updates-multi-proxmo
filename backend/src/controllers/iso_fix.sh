#!/bin/bash

# Fix unused variable by prefixing with underscore (already named _getProxmoxTicket, so no fix needed)

# Fix line 386 - targetClusterIds JSON.parse
sed -i '386s/JSON.parse(dbJob.target_cluster_ids)/JSON.parse(dbJob.target_cluster_ids as string)/' isoSyncController.ts

# Fix line 387 - status null check
sed -i '387s/status: dbJob.status,/status: (dbJob.status || "pending") as "pending" | "in_progress" | "completed" | "failed",/' isoSyncController.ts

# Fix line 388 - progress null check
sed -i '388s/progress: dbJob.progress,/progress: dbJob.progress || 0,/' isoSyncController.ts

# Fix line 389 - results JSON.parse
sed -i '389s/JSON.parse(dbJob.results || '\''['\'']/JSON.parse((dbJob.results as string) || '\''[]'\'')/' isoSyncController.ts

# Fix line 390 - completedAt null check
sed -i '390s/completedAt: dbJob.completed_at,/completedAt: dbJob.completed_at || undefined,/' isoSyncController.ts

# Fix line 391 - error null check
sed -i '391s/error: dbJob.error$/error: dbJob.error || undefined/' isoSyncController.ts

echo 'ISO controller fixes part 1 applied'
