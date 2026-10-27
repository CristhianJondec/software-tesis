-- Theses uploaded before the upload counter existed (0013) count against the
-- cap too. Only fully processed theses (with segments) count, as in
-- saveBookSegments; GREATEST never lowers a counter already in use.
UPDATE "users" AS u
SET "thesis_uploads" = GREATEST(u."thesis_uploads", b.uploaded)
FROM (
    SELECT "user_id", COUNT(*)::integer AS uploaded
    FROM "books"
    WHERE "total_segments" > 0
    GROUP BY "user_id"
) AS b
WHERE b."user_id" = u."id";
