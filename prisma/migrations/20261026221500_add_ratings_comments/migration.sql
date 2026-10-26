-- Only the Rating and Comment tables are added by this migration.
-- Book and User must already exist. Prisma supplies the cuid() record IDs.
BEGIN;

CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Rating_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Comment_comment_check" CHECK (length(btrim("comment")) > 0)
);

CREATE INDEX "Rating_bookId_idx" ON "Rating"("bookId");
CREATE INDEX "Rating_userId_idx" ON "Rating"("userId");
CREATE INDEX "Comment_bookId_createdAt_idx" ON "Comment"("bookId", "createdAt");
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

ALTER TABLE "Rating" ADD CONSTRAINT "Rating_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Express connects using the server-side Postgres credentials. These tables
-- have no anonymous/Supabase-Auth policies. Existing tables are unchanged.
ALTER TABLE "Rating" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE client_role TEXT;
BEGIN
    FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
            EXECUTE format('REVOKE ALL ON TABLE public."Rating", public."Comment" FROM %I', client_role);
        END IF;
    END LOOP;
END;
$$;

COMMIT;
