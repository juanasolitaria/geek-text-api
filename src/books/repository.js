const { PrismaClient } = require("@prisma/client");

// Maps the public sort keys to the columns exposed by the Book model.
const SORT_FIELDS = {
  title: "title",
  author: "author",
  price: "price",
};

// The routes only depend on listBooks, so a Prisma client can be swapped out
// for a lightweight fake in tests.
function createBookRepository(prisma = new PrismaClient()) {
  return {
    async listBooks({ sortBy = "title", order = "asc" } = {}) {
      return prisma.book.findMany({
        orderBy: { [SORT_FIELDS[sortBy]]: order },
      });
    },
  };
}

module.exports = { createBookRepository, SORT_FIELDS };
