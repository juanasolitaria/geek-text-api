const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const books = [
  {
    title: "The Pragmatic Programmer",
    author: "Andrew Hunt",
    genre: "Software Engineering",
    isbn: "9780201616224",
    price: 49.99,
    description: "Your journey to mastery, from journeyman to master.",
  },
  {
    title: "Clean Code",
    author: "Robert C. Martin",
    genre: "Software Engineering",
    isbn: "9780132350884",
    price: 42.5,
    description: "A handbook of agile software craftsmanship.",
  },
  {
    title: "Eloquent JavaScript",
    author: "Marijn Haverbeke",
    genre: "Programming",
    isbn: "9781593279509",
    price: 29.95,
    description: "A modern introduction to programming.",
  },
  {
    title: "Structure and Interpretation of Computer Programs",
    author: "Harold Abelson",
    genre: "Computer Science",
    isbn: "9780262510875",
    price: 55.0,
    description: "The classic MIT introductory computer science text.",
  },
  {
    title: "Neuromancer",
    author: "William Gibson",
    genre: "Science Fiction",
    isbn: "9780441569595",
    price: 16.99,
    description: "The novel that defined the cyberpunk genre.",
  },
  {
    title: "Dune",
    author: "Frank Herbert",
    genre: "Science Fiction",
    isbn: "9780441172719",
    price: 18.75,
    description: "A sweeping tale of politics, religion, and ecology.",
  },
  {
    title: "The Hitchhiker's Guide to the Galaxy",
    author: "Douglas Adams",
    genre: "Science Fiction",
    isbn: "9780345391803",
    price: 14.5,
    description: "A comedic adventure across the cosmos.",
  },
  {
    title: "Refactoring",
    author: "Martin Fowler",
    genre: "Software Engineering",
    isbn: "9780134757599",
    price: 52.0,
    description: "Improving the design of existing code.",
  },
];

async function main() {
  console.log("Seeding the Book table...");

  for (const book of books) {
    await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: book,
      create: book,
    });
  }

  const total = await prisma.book.count();
  console.log(`Seed complete. Book table now holds ${total} records.`);
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
