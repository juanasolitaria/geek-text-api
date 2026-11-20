const { PrismaClient } = require("@prisma/client");

// Maps the public sort keys to the columns exposed by the Book model.
const SORT_FIELDS = {
  title: "title",
  author: "author",
  price: "price",
};

// The routes only depend on the repository, so a Prisma client can be swapped out
// for a lightweight fake in tests.
function createBookRepository(prisma = new PrismaClient()) {
  return {
    async listBooks({ sortBy = "title", order = "asc" } = {}) {
      return prisma.book.findMany({
        orderBy: { [SORT_FIELDS[sortBy]]: order },
      });
    },

    async listBooksByGenre(genre) {
      return prisma.$queryRaw`
        SELECT *
        FROM "Book"
        WHERE LOWER("genre") = LOWER(${genre})
        ORDER BY "title", "id"
      `;
    },

    async listTopSellers() {
      return prisma.book.findMany({
        where: { copiesSold: { gt: 0 } },
        orderBy: [{ copiesSold: "desc" }, { title: "asc" }, { id: "asc" }],
        take: 10,
      });
    },

    async listBooksByMinRating(minRating) {
      return prisma.$queryRaw`
        SELECT b.*, AVG(r."rating")::double precision AS "averageRating"
        FROM "Book" AS b
        JOIN "Rating" AS r ON r."bookId" = b."id"
        GROUP BY b."id"
        HAVING AVG(r."rating") >= ${minRating}::numeric
        ORDER BY "averageRating" DESC, b."title", b."id"
      `;
    },

    async discountBooksByPublisher(publisher, percentage) {
      return prisma.$executeRaw`
        UPDATE "Book"
        SET "price" = ROUND("price" * (1 - ${percentage}::numeric / 100), 2),
            "updatedAt" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
        WHERE LOWER("publisher") = LOWER(${publisher}) AND "price" IS NOT NULL
      `;
    },

    async getBookById(id) {
      return prisma.book.findUnique({ where: { id } });
    },
  };
}

module.exports = { createBookRepository, SORT_FIELDS };
