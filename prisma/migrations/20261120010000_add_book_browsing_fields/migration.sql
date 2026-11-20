ALTER TABLE "Book"
ADD COLUMN "publisher" TEXT,
ADD COLUMN "copiesSold" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "Book_copiesSold_nonnegative" CHECK ("copiesSold" >= 0);
